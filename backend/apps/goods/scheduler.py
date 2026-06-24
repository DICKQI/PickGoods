"""APScheduler 进程内调度器，仅在 web/manage.py 启动时生效。

注意：
- 通过 ``BGM_SCHEDULER_DISABLED=1`` 可关闭，CI / 测试请始终关闭；
- 通过 ``RUN_MAIN`` 防止 ``runserver`` 重载父进程多注册；
- ``gunicorn`` 多 worker 下，每个 worker 都会启动一份调度器；通过
  ``bgm_auto_sync.try_acquire_run_slot()`` 内的 ``select_for_update`` 行锁
  保证全局仅一个 worker 执行同步。
"""
from __future__ import annotations

import logging
import os
import sys
import threading

logger = logging.getLogger(__name__)

# 每 5 分钟检查一次是否到达 next_run_at
_TICK_MINUTES = 5

_scheduler = None
_scheduler_lock = threading.Lock()


def _bgm_tick() -> None:
    """调度器 tick：检查是否应触发自动同步，并在抢占成功时执行。"""
    try:
        from .bgm_auto_sync import run_auto_sync, try_acquire_run_slot

        if not try_acquire_run_slot():
            return
        logger.info("[BGMScheduler] tick acquired slot, starting scheduled sync")
        run_auto_sync(trigger="scheduled")
    except Exception:  # noqa: BLE001
        logger.exception("[BGMScheduler] tick failed")


def _should_start() -> bool:
    """判断当前进程是否应启动调度器。"""
    if os.environ.get("BGM_SCHEDULER_DISABLED") == "1":
        return False
    # 仅在 runserver / gunicorn / asgi server 启动场景下启用；
    # makemigrations / migrate / shell / test 等命令禁用。
    argv = sys.argv
    blacklist = {
        "makemigrations",
        "migrate",
        "shell",
        "shell_plus",
        "test",
        "loaddata",
        "dumpdata",
        "collectstatic",
        "createsuperuser",
        "seed_users",
        "seed_test_data",
        "rebalance_goods_order",
        "download_ocr_models",
        "spectacular",
        "showmigrations",
        "check",
    }
    if len(argv) >= 2 and argv[1] in blacklist:
        return False
    # runserver 在 RUN_MAIN!=true 的父进程里只是 watcher，跳过
    if len(argv) >= 2 and argv[1] == "runserver":
        if os.environ.get("RUN_MAIN") != "true":
            return False
    return True


def start_scheduler() -> None:
    """启动调度器（幂等）。"""
    global _scheduler
    if not _should_start():
        return

    with _scheduler_lock:
        if _scheduler is not None:
            return
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from apscheduler.triggers.interval import IntervalTrigger
        except ImportError:
            logger.warning(
                "[BGMScheduler] APScheduler not installed, auto-sync scheduler disabled"
            )
            return

        scheduler = BackgroundScheduler(timezone="UTC")
        scheduler.add_job(
            _bgm_tick,
            trigger=IntervalTrigger(minutes=_TICK_MINUTES),
            id="bgm_sync_tick",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
        scheduler.start()
        _scheduler = scheduler
        logger.info(
            "[BGMScheduler] started, tick every %d minutes", _TICK_MINUTES
        )
