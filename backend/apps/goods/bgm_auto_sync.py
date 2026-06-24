"""
BGM 自动同步：周期/手动一键扫描所有已绑定 BGM 的 IP 并增量同步角色。

设计要点：
- 复用 ``bgm_sync.compute_bgm_diff`` + ``apply_bgm_sync``，与手动「从 BGM 更新」逻辑一致；
- 仅处理 ``IP.bgm_subject_id`` 已绑定的 IP；未绑定 IP 视为 ``skipped_unbound``；
- 单 IP 失败隔离：捕获异常写 ``BGMSyncJobItem.error_message`` 后继续下一个 IP；
- IP 间礼貌等待 ``request_interval_ms``，避免对 BGM API 过快请求；
- 顶层异常摘要写入 ``BGMSyncJob.error_message`` 并标记 ``status=failed``；
- 完成后写 ``BGMSyncSettings.last_run_at`` 与 ``next_run_at``：
  * 成功/部分成功 → 按 frequency 推算下次窗口；
  * 全部失败 → 短间隔重试（避免错过整个同步周期）。
- 手动触发（run-now）在后台线程执行，HTTP 立即返回，避免阻塞 worker / 前端超时。

可独立单测：通过依赖注入 ``service`` 参数把 bgm_service 中的两个函数 mock 掉。
"""
from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass
from datetime import timedelta
from typing import Callable, Optional

from django.db import transaction
from django.utils import timezone

from . import bgm_service as default_bgm_service
from .bgm_sync import apply_bgm_sync, compute_bgm_diff
from .models import (
    BGMSyncJob,
    BGMSyncJobItem,
    BGMSyncSettings,
    IP,
)

logger = logging.getLogger(__name__)


# 频率到时间间隔
_FREQUENCY_DELTA = {
    "daily": timedelta(days=1),
    "every_3_days": timedelta(days=3),
    "weekly": timedelta(days=7),
}

# 同步全失败后的快速重试间隔（避免等待整个 frequency 周期）
_RETRY_DELTA = timedelta(minutes=10)

# 僵尸任务回收阈值的默认值（小时）。worker 崩溃 / 被 kill 后 running 任务超过该
# 时长视为僵尸，在下次触发同步时被标记为 failed。可通过环境变量
# ``BGM_ZOMBIE_TIMEOUT_HOURS`` 覆盖——当已绑定 IP 数量很大、单次合法同步可能
# 超过默认 2 小时时，应调大该值，避免误杀仍在正常执行的任务。
_ZOMBIE_TIMEOUT_DEFAULT_HOURS = 2


def _zombie_timeout() -> timedelta:
    """读取当前僵尸回收阈值，支持运行期通过环境变量覆盖。

    合法范围 [0.5, 72] 小时：过小易误杀正常长任务，过大则僵尸回收不及时。
    非法 / 缺失时回落到默认值。
    """
    raw = os.environ.get("BGM_ZOMBIE_TIMEOUT_HOURS")
    if not raw:
        return timedelta(hours=_ZOMBIE_TIMEOUT_DEFAULT_HOURS)
    try:
        hours = float(raw)
    except (TypeError, ValueError):
        logger.warning(
            "BGM_ZOMBIE_TIMEOUT_HOURS=%r 无法解析为数字，使用默认 %s 小时",
            raw, _ZOMBIE_TIMEOUT_DEFAULT_HOURS,
        )
        return timedelta(hours=_ZOMBIE_TIMEOUT_DEFAULT_HOURS)
    if hours < 0.5 or hours > 72:
        logger.warning(
            "BGM_ZOMBIE_TIMEOUT_HOURS=%s 超出合法范围 [0.5, 72]，使用默认 %s 小时",
            hours, _ZOMBIE_TIMEOUT_DEFAULT_HOURS,
        )
        return timedelta(hours=_ZOMBIE_TIMEOUT_DEFAULT_HOURS)
    return timedelta(hours=hours)


def compute_next_run_at(frequency: str, last_run_at) -> "timezone.datetime":
    """根据频率与上次执行时间推算下次执行时间。"""
    delta = _FREQUENCY_DELTA.get(frequency, _FREQUENCY_DELTA["weekly"])
    base = last_run_at or timezone.now()
    return base + delta


@dataclass
class _BGMService:
    """便于测试时注入的 service 协议封装。"""

    get_subject_info: Callable[[int], Optional[dict]]
    get_characters: Callable[[int], list]


def _default_service() -> _BGMService:
    return _BGMService(
        get_subject_info=default_bgm_service.get_subject_info,
        get_characters=default_bgm_service.get_characters,
    )


def run_auto_sync(
    trigger: str = "scheduled",
    triggered_by=None,
    service: Optional[_BGMService] = None,
    request_interval_ms: Optional[int] = None,
) -> BGMSyncJob:
    """同步执行一轮 BGM 自动/手动同步（阻塞直到完成）。

    供调度器线程调用。手动触发请改用 :func:`start_manual_sync`（后台线程）。

    Args:
        trigger: ``"scheduled"`` 或 ``"manual"``。
        triggered_by: 手动触发时的 User 对象。
        service: 可注入的 bgm_service 协议（测试用）；为 None 使用默认 HTTP 实现。
        request_interval_ms: 覆盖配置中的 IP 间请求间隔（毫秒）。

    Returns:
        BGMSyncJob: 已写入 DB 的任务记录（含 finished_at / status / 汇总字段）。
    """
    svc = service or _default_service()
    settings_row = BGMSyncSettings.get_solo()
    interval_ms = (
        request_interval_ms
        if request_interval_ms is not None
        else settings_row.request_interval_ms
    )

    job = BGMSyncJob.objects.create(
        trigger=trigger,
        status="running",
        triggered_by=triggered_by,
    )
    _execute_job(job, svc, interval_ms, settings_row)
    return job


def _execute_job(
    job: BGMSyncJob,
    svc: _BGMService,
    interval_ms: int,
    settings_row: BGMSyncSettings,
) -> None:
    """实际执行一轮同步（同步阻塞）。供 run_auto_sync 与异步线程复用。"""
    try:
        bound_qs = IP.objects.filter(bgm_subject_id__isnull=False).order_by("id")
        total = bound_qs.count()
        job.total_ips = total
        job.save(update_fields=["total_ips"])

        success = 0
        failed = 0
        skipped = 0
        created_total = 0
        linked_total = 0

        for index, ip in enumerate(bound_qs):
            t_start = time.monotonic()
            item_kwargs = dict(
                job=job,
                ip=ip,
                ip_name_snapshot=ip.name,
                bgm_subject_id=ip.bgm_subject_id,
            )

            try:
                subject_info = svc.get_subject_info(ip.bgm_subject_id)
                if not subject_info:
                    raise RuntimeError(
                        f"BGM 找不到 subject_id={ip.bgm_subject_id}（可能已下线）"
                    )
                bgm_characters = svc.get_characters(ip.bgm_subject_id)
                diff = compute_bgm_diff(ip, bgm_characters)

                # 自动模式：把所有 new / link_by_name 全部确认应用
                items_to_apply = [
                    it
                    for it in diff["items"]
                    if it["action"] in ("new", "link_by_name")
                ]

                if not items_to_apply and not (
                    subject_info.get("type") is not None
                    and ip.subject_type != subject_info.get("type")
                ) and ip.bgm_subject_id is not None:
                    # 完全没有变更
                    duration_ms = int((time.monotonic() - t_start) * 1000)
                    BGMSyncJobItem.objects.create(
                        status="no_change",
                        created_count=0,
                        linked_count=0,
                        subject_type_updated=False,
                        duration_ms=duration_ms,
                        **item_kwargs,
                    )
                    success += 1
                else:
                    result = apply_bgm_sync(
                        ip=ip,
                        bgm_subject_id=ip.bgm_subject_id,
                        items=items_to_apply,
                        bgm_subject_type=subject_info.get("type"),
                        update_subject_type=True,
                    )
                    duration_ms = int((time.monotonic() - t_start) * 1000)
                    BGMSyncJobItem.objects.create(
                        status="success",
                        created_count=result["created_count"],
                        linked_count=result["linked_count"],
                        subject_type_updated=result["subject_type_updated"],
                        duration_ms=duration_ms,
                        **item_kwargs,
                    )
                    success += 1
                    created_total += result["created_count"]
                    linked_total += result["linked_count"]
            except Exception as exc:  # noqa: BLE001 - 隔离失败
                logger.warning(
                    "BGM auto sync failed for IP id=%s name=%s: %s",
                    ip.id,
                    ip.name,
                    exc,
                )
                duration_ms = int((time.monotonic() - t_start) * 1000)
                BGMSyncJobItem.objects.create(
                    status="error",
                    error_message=str(exc)[:2000],
                    duration_ms=duration_ms,
                    **item_kwargs,
                )
                failed += 1

            # 礼貌等待，最后一条不等
            if interval_ms > 0 and index < total - 1:
                time.sleep(interval_ms / 1000.0)

        # 决定任务状态
        if failed == 0 and success > 0:
            job.status = "succeeded"
        elif success == 0 and failed > 0:
            job.status = "failed"
        elif failed > 0 and success > 0:
            job.status = "partial"
        else:
            # 总数为 0：仍视为 succeeded（没有可同步的 IP）
            job.status = "succeeded"

        job.success_count = success
        job.failed_count = failed
        job.skipped_count = skipped
        job.created_total = created_total
        job.linked_total = linked_total

    except Exception as exc:  # 顶层异常
        logger.exception("BGM auto sync job %s aborted", job.id)
        job.status = "failed"
        job.error_message = str(exc)[:2000]

    finally:
        job.finished_at = timezone.now()
        job.save()
        # 仅在非完全失败时按 frequency 推进下次窗口；全失败则短间隔重试
        _update_settings_run_marks(
            settings_row, finished_at=job.finished_at, status=job.status
        )


def _update_settings_run_marks(
    settings_row: BGMSyncSettings, finished_at, status: str
) -> None:
    """事务内更新 last_run_at / next_run_at（行锁保证并发安全）。

    - ``auto_sync_enabled`` 关闭：``next_run_at`` 置空，避免 UI 显示无效的下次
      执行时间（手动触发的同步也不应排定后续自动窗口）；
    - ``status == "failed"``：``next_run_at = finished_at + 短重试间隔``，尽快重试；
    - 其它：``next_run_at = finished_at + frequency`` 间隔。
    """
    with transaction.atomic():
        locked = (
            BGMSyncSettings.objects.select_for_update().filter(pk=settings_row.pk).first()
        )
        if locked is None:
            return
        locked.last_run_at = finished_at
        if not locked.auto_sync_enabled:
            # 自动同步已关闭：不应排定下次执行时间，保持 UI 与调度器一致。
            locked.next_run_at = None
        elif status == "failed":
            locked.next_run_at = finished_at + _RETRY_DELTA
        else:
            locked.next_run_at = compute_next_run_at(locked.frequency, finished_at)
        locked.save(update_fields=["last_run_at", "next_run_at", "updated_at"])


def _reclaim_zombie_jobs() -> int:
    """回收僵尸 running 任务：worker 崩溃 / 被 kill 后永久停在 running 的任务。

    将 started_at 早于 ``_ZOMBIE_TIMEOUT`` 的 running 任务标记为 failed，
    避免死任务永久阻塞后续所有同步（手动触发与定时调度都依赖 status=running 互斥）。

    Returns:
        被回收的任务数（用于日志/审计）。
    """
    timeout = _zombie_timeout()
    cutoff = timezone.now() - timeout
    zombies = BGMSyncJob.objects.filter(
        status="running", started_at__lt=cutoff
    )
    count = zombies.update(
        status="failed",
        finished_at=timezone.now(),
        error_message="任务超时未完成，已作为僵尸任务自动回收（worker 可能崩溃）",
    )
    if count:
        logger.warning("回收 %d 个僵尸 BGM 同步任务（running 超 %s）", count, timeout)
    return count


def start_manual_sync(triggered_by) -> BGMSyncJob:
    """供 run-now 接口调用：创建 job 后在后台线程执行，立即返回。

    与 :func:`run_auto_sync` 的区别：后者阻塞当前线程直到同步完成（供调度器
    线程使用）；本函数把执行丢到 daemon 线程，HTTP 请求可立即返回 job 摘要。

    互斥通过 ``transaction.atomic()`` + 对 ``BGMSyncSettings`` 单例行
    ``select_for_update`` 实现：检查 running 与创建 job 在同一事务内完成，
    两个并发的手动请求会被行锁串行化，只有一个能成功创建 job，杜绝 TOCTOU。

    Raises:
        RuntimeError: 已有 running 任务正在执行。
    """
    svc = _default_service()
    with transaction.atomic():
        # 行锁串行化并发手动请求；锁单例 settings 行即可（pk 固定为 1）
        BGMSyncSettings.objects.select_for_update().filter(pk=1).first()
        # 抢占前先回收僵尸任务，避免死任务挡死手动触发
        _reclaim_zombie_jobs()
        if BGMSyncJob.objects.filter(status="running").exists():
            raise RuntimeError("已有同步任务正在执行中，请等待完成后再试")
        settings_row = BGMSyncSettings.get_solo()
        job = BGMSyncJob.objects.create(
            trigger="manual",
            status="running",
            triggered_by=triggered_by,
        )

    def _bg():
        # 后台线程需要主动关闭过期连接，避免长任务持有 stale DB connection
        from django.db import close_old_connections
        close_old_connections()
        try:
            _execute_job(job, svc, settings_row.request_interval_ms, settings_row)
        except Exception:  # pragma: no cover - 兜底
            logger.exception("manual bgm sync thread crashed for job %s", job.id)
        finally:
            close_old_connections()

    t = threading.Thread(target=_bg, daemon=True, name=f"bgm-sync-{job.id}")
    t.start()
    return job


def try_acquire_run_slot() -> bool:
    """调度器 tick 调用：尝试抢占执行权。

    返回 True 表示当前 worker 应负责本轮同步；False 表示无需执行（窗口未到、
    开关关闭、或已有 running 任务）。

    使用 ``select_for_update`` + 行内时间戳实现轻量分布式锁，避免多 worker
    重复触发。抢占时先把 ``next_run_at`` 推到将来一个 frequency 间隔作为
    锁令牌；实际下次时间由 :func:`_execute_job` 完成后按结果覆写。
    """
    now = timezone.now()
    with transaction.atomic():
        s = BGMSyncSettings.objects.select_for_update().filter(pk=1).first()
        if s is None:
            return False
        if not s.auto_sync_enabled:
            return False
        if s.next_run_at is not None and s.next_run_at > now:
            return False
        # 抢占前先回收僵尸任务，避免死任务挡死定时调度
        _reclaim_zombie_jobs()
        # 检查是否已有 running 任务
        if BGMSyncJob.objects.filter(status="running").exists():
            return False
        # 抢占：先把 next_run_at 推到将来，防止其他 worker 同时进入
        s.next_run_at = compute_next_run_at(s.frequency, now)
        s.save(update_fields=["next_run_at", "updated_at"])
        return True
