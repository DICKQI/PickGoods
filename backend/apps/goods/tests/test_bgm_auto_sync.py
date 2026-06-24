"""
Unit tests for goods.bgm_auto_sync.run_auto_sync.

只覆盖核心算法的行为契约，通过依赖注入 mock BGM HTTP，不触达外部网络。
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.goods.bgm_auto_sync import (
    _BGMService,
    _zombie_timeout,
    _reclaim_zombie_jobs,
    run_auto_sync,
    start_manual_sync,
    try_acquire_run_slot,
)
from apps.goods.models import (
    BGMSyncJob,
    BGMSyncJobItem,
    BGMSyncSettings,
    Character,
    IP,
)


def _make_service(subjects: dict, characters: dict, raise_for=None):
    """构造一个 mock BGM service。

    Args:
        subjects: subject_id -> subject_info dict
        characters: subject_id -> list of character dict
        raise_for: subject_id -> exception (用于模拟错误)
    """
    raise_for = raise_for or {}

    def get_subject_info(subject_id):
        if subject_id in raise_for:
            raise raise_for[subject_id]
        return subjects.get(subject_id)

    def get_characters(subject_id):
        if subject_id in raise_for:
            raise raise_for[subject_id]
        return characters.get(subject_id, [])

    return _BGMService(
        get_subject_info=get_subject_info,
        get_characters=get_characters,
    )


class RunAutoSyncTests(TestCase):
    def setUp(self):
        # 三个 IP：两个已绑定 BGM，一个未绑定（应被跳过）
        self.ip_bound1 = IP.objects.create(name="A作品", bgm_subject_id=100, subject_type=2)
        self.ip_bound2 = IP.objects.create(name="B作品", bgm_subject_id=200)
        self.ip_unbound = IP.objects.create(name="C作品")
        # 让 BGMSyncSettings 单例存在
        BGMSyncSettings.get_solo()

    def test_only_bound_ips_are_processed(self):
        svc = _make_service(
            subjects={
                100: {"display_name": "A", "type": 2},
                200: {"display_name": "B", "type": 2},
            },
            characters={100: [], 200: []},
        )
        job = run_auto_sync(trigger="manual", service=svc, request_interval_ms=0)
        # 未绑定 IP 不参与处理
        self.assertEqual(job.total_ips, 2)
        names = list(job.items.values_list("ip_name_snapshot", flat=True))
        self.assertIn("A作品", names)
        self.assertIn("B作品", names)
        self.assertNotIn("C作品", names)

    def test_new_characters_are_created(self):
        svc = _make_service(
            subjects={100: {"display_name": "A", "type": 2}, 200: {"display_name": "B", "type": 2}},
            characters={
                100: [{"id": 1, "name": "Alice", "relation": "主角", "avatar": ""}],
                200: [{"id": 2, "name": "Bob", "relation": "主角", "avatar": ""}],
            },
        )
        job = run_auto_sync(trigger="scheduled", service=svc, request_interval_ms=0)
        self.assertEqual(job.status, "succeeded")
        self.assertEqual(job.success_count, 2)
        self.assertEqual(job.failed_count, 0)
        self.assertEqual(job.created_total, 2)
        self.assertTrue(Character.objects.filter(ip=self.ip_bound1, name="Alice").exists())
        self.assertTrue(Character.objects.filter(ip=self.ip_bound2, name="Bob").exists())

    def test_one_ip_failure_does_not_abort_others(self):
        svc = _make_service(
            subjects={
                100: {"display_name": "A", "type": 2},
                200: {"display_name": "B", "type": 2},
            },
            characters={
                200: [{"id": 2, "name": "Bob", "relation": "主角", "avatar": ""}],
            },
            raise_for={100: RuntimeError("BGM timeout")},
        )
        job = run_auto_sync(trigger="manual", service=svc, request_interval_ms=0)
        self.assertEqual(job.status, "partial")
        self.assertEqual(job.success_count, 1)
        self.assertEqual(job.failed_count, 1)
        # 失败的 IP 写入了错误明细
        error_item = job.items.get(ip=self.ip_bound1)
        self.assertEqual(error_item.status, "error")
        self.assertIn("BGM timeout", error_item.error_message)
        # 成功的 IP 不受影响
        ok_item = job.items.get(ip=self.ip_bound2)
        self.assertEqual(ok_item.status, "success")

    def test_no_change_marks_no_change_status(self):
        # 已存在的 Character 与 BGM 数据一致（按 bgm_character_id 精确匹配）
        # 同时两个 IP 的 subject_type 都与 BGM 一致，避免触发 subject_type 更新分支
        self.ip_bound1.subject_type = 2
        self.ip_bound1.save(update_fields=["subject_type"])
        self.ip_bound2.subject_type = 2
        self.ip_bound2.save(update_fields=["subject_type"])
        Character.objects.create(
            ip=self.ip_bound1, name="Alice", bgm_character_id=1
        )
        Character.objects.create(
            ip=self.ip_bound2, name="Bob", bgm_character_id=2
        )
        svc = _make_service(
            subjects={
                100: {"display_name": "A", "type": 2},
                200: {"display_name": "B", "type": 2},
            },
            characters={
                100: [{"id": 1, "name": "Alice", "relation": "主角", "avatar": ""}],
                200: [{"id": 2, "name": "Bob", "relation": "主角", "avatar": ""}],
            },
        )
        job = run_auto_sync(trigger="scheduled", service=svc, request_interval_ms=0)
        self.assertEqual(job.status, "succeeded")
        for item in job.items.all():
            self.assertEqual(item.status, "no_change")
            self.assertEqual(item.created_count, 0)

    def test_all_failures_marks_failed(self):
        svc = _make_service(
            subjects={
                100: {"display_name": "A", "type": 2},
                200: {"display_name": "B", "type": 2},
            },
            characters={},
            raise_for={
                100: RuntimeError("e1"),
                200: RuntimeError("e2"),
            },
        )
        job = run_auto_sync(trigger="scheduled", service=svc, request_interval_ms=0)
        self.assertEqual(job.status, "failed")
        self.assertEqual(job.success_count, 0)
        self.assertEqual(job.failed_count, 2)

    def test_settings_run_marks_are_updated(self):
        # 启用自动同步：完成后应同时更新 last_run_at 与 next_run_at
        settings_row = BGMSyncSettings.get_solo()
        settings_row.auto_sync_enabled = True
        settings_row.save(update_fields=["auto_sync_enabled"])

        svc = _make_service(
            subjects={
                100: {"display_name": "A", "type": 2},
                200: {"display_name": "B", "type": 2},
            },
            characters={100: [], 200: []},
        )
        run_auto_sync(trigger="scheduled", service=svc, request_interval_ms=0)
        settings_row = BGMSyncSettings.get_solo()
        self.assertIsNotNone(settings_row.last_run_at)
        self.assertIsNotNone(settings_row.next_run_at)
        self.assertGreater(settings_row.next_run_at, settings_row.last_run_at)

    def test_next_run_at_cleared_when_auto_sync_disabled(self):
        """auto_sync_enabled=False 时，同步完成后不应排定 next_run_at。

        防止 UI 在关闭自动同步后仍显示一个过期或将来的下次执行时间。
        """
        # 默认 auto_sync_enabled=False，先模拟一个已存在的 next_run_at
        settings_row = BGMSyncSettings.get_solo()
        self.assertFalse(settings_row.auto_sync_enabled)
        settings_row.next_run_at = timezone.now() + timedelta(days=1)
        settings_row.save(update_fields=["next_run_at"])

        svc = _make_service(
            subjects={
                100: {"display_name": "A", "type": 2},
                200: {"display_name": "B", "type": 2},
            },
            characters={100: [], 200: []},
        )
        run_auto_sync(trigger="manual", service=svc, request_interval_ms=0)
        settings_row = BGMSyncSettings.get_solo()
        self.assertIsNotNone(settings_row.last_run_at)
        self.assertIsNone(settings_row.next_run_at)


def _make_old_running_job(trigger="manual", age=timedelta(hours=3)):
    """创建一个 started_at 在 age 之前的 running 任务，模拟 worker 崩溃后的僵尸。"""
    job = BGMSyncJob.objects.create(trigger=trigger, status="running")
    BGMSyncJob.objects.filter(pk=job.id).update(
        started_at=timezone.now() - age
    )
    return BGMSyncJob.objects.get(pk=job.id)


def _make_recent_running_job(trigger="manual"):
    """创建一个刚刚开始的 running 任务（非僵尸）。"""
    return BGMSyncJob.objects.create(trigger=trigger, status="running")


class ZombieReclamationTests(TestCase):
    """覆盖 _reclaim_zombie_jobs：worker 崩溃后僵尸 running 任务的回收。"""

    def setUp(self):
        BGMSyncSettings.get_solo()

    def test_old_running_job_is_marked_failed(self):
        zombie = _make_old_running_job()
        count = _reclaim_zombie_jobs()
        self.assertEqual(count, 1)
        zombie.refresh_from_db()
        self.assertEqual(zombie.status, "failed")
        self.assertIsNotNone(zombie.finished_at)
        self.assertIn("僵尸", zombie.error_message)

    def test_recent_running_job_is_not_reclaimed(self):
        recent = _make_recent_running_job()
        count = _reclaim_zombie_jobs()
        self.assertEqual(count, 0)
        recent.refresh_from_db()
        self.assertEqual(recent.status, "running")
        self.assertIsNone(recent.finished_at)

    def test_boundary_not_reclaimed_within_timeout(self):
        # 刚好卡在阈值内侧（小于 _ZOMBIE_TIMEOUT）的 running 不应被回收
        timeout = _zombie_timeout()
        job = _make_old_running_job(age=timeout - timedelta(minutes=1))
        count = _reclaim_zombie_jobs()
        self.assertEqual(count, 0)
        job.refresh_from_db()
        self.assertEqual(job.status, "running")

    def test_boundary_reclaimed_beyond_timeout(self):
        # 超过阈值 1 分钟的 running 应被回收
        timeout = _zombie_timeout()
        job = _make_old_running_job(age=timeout + timedelta(minutes=1))
        count = _reclaim_zombie_jobs()
        self.assertEqual(count, 1)
        job.refresh_from_db()
        self.assertEqual(job.status, "failed")

    def test_env_var_overrides_zombie_timeout(self):
        """BGM_ZOMBIE_TIMEOUT_HOURS 应覆盖默认阈值。

        设为 0.5 小时（30 分钟），则一个 started_at 在 40 分钟前的 running
        任务应被回收（默认 2 小时下不会被回收），验证 env 生效。
        """
        with self.settings(BGM_ZOMBIE_TIMEOUT_HOURS="0.5"):
            # 注意：settings 机制只覆盖 Django 配置，不覆盖 os.environ；
            # 这里直接设置环境变量更贴近真实加载路径。
            import os
            old = os.environ.get("BGM_ZOMBIE_TIMEOUT_HOURS")
            os.environ["BGM_ZOMBIE_TIMEOUT_HOURS"] = "0.5"
            try:
                self.assertEqual(_zombie_timeout(), timedelta(minutes=30))
                job = _make_old_running_job(age=timedelta(minutes=40))
                count = _reclaim_zombie_jobs()
                self.assertEqual(count, 1)
                job.refresh_from_db()
                self.assertEqual(job.status, "failed")
            finally:
                if old is None:
                    os.environ.pop("BGM_ZOMBIE_TIMEOUT_HOURS", None)
                else:
                    os.environ["BGM_ZOMBIE_TIMEOUT_HOURS"] = old

    def test_invalid_env_var_falls_back_to_default(self):
        """非法 env 值应回退到默认 2 小时，不抛异常。"""
        import os
        old = os.environ.get("BGM_ZOMBIE_TIMEOUT_HOURS")
        os.environ["BGM_ZOMBIE_TIMEOUT_HOURS"] = "not-a-number"
        try:
            self.assertEqual(_zombie_timeout(), timedelta(hours=2))
        finally:
            if old is None:
                os.environ.pop("BGM_ZOMBIE_TIMEOUT_HOURS", None)
            else:
                os.environ["BGM_ZOMBIE_TIMEOUT_HOURS"] = old

    def test_only_running_jobs_are_affected(self):
        # 已结束的任务即便 started_at 很老也不受影响
        old_done = _make_old_running_job()
        BGMSyncJob.objects.filter(pk=old_done.id).update(status="succeeded")
        count = _reclaim_zombie_jobs()
        self.assertEqual(count, 0)
        old_done.refresh_from_db()
        self.assertEqual(old_done.status, "succeeded")


class TryAcquireRunSlotTests(TestCase):
    """覆盖 try_acquire_run_slot：僵尸回收后定时调度应能抢占，而非被死任务挡死。"""

    def setUp(self):
        s = BGMSyncSettings.get_solo()
        s.auto_sync_enabled = True
        # 窗口已到，调度器应尝试抢占
        s.next_run_at = timezone.now() - timedelta(minutes=5)
        s.save(update_fields=["auto_sync_enabled", "next_run_at"])

    def test_zombie_unblocks_scheduled_acquire(self):
        # 僵尸 running 任务存在，过去会永久挡死调度
        zombie = _make_old_running_job(trigger="scheduled")
        acquired = try_acquire_run_slot()
        self.assertTrue(acquired)
        zombie.refresh_from_db()
        self.assertEqual(zombie.status, "failed")

    def test_recent_running_blocks_scheduled_acquire(self):
        # 正常 running 任务应阻止重复触发
        _make_recent_running_job(trigger="scheduled")
        acquired = try_acquire_run_slot()
        self.assertFalse(acquired)

    def test_disabled_auto_sync_does_not_acquire(self):
        s = BGMSyncSettings.get_solo()
        s.auto_sync_enabled = False
        s.save(update_fields=["auto_sync_enabled"])
        acquired = try_acquire_run_slot()
        self.assertFalse(acquired)

    def test_future_window_does_not_acquire(self):
        s = BGMSyncSettings.get_solo()
        s.next_run_at = timezone.now() + timedelta(days=1)
        s.save(update_fields=["next_run_at"])
        acquired = try_acquire_run_slot()
        self.assertFalse(acquired)


class ManualSyncMutexTests(TestCase):
    """覆盖 start_manual_sync：互斥检查与僵尸回收。

    注：start_manual_sync 把实际同步丢到后台 daemon 线程。本测试只关心抢占前
    在主线程事务内完成的互斥检查与僵尸回收，因此 patch 掉 _execute_job 使
    后台线程空转，避免与测试事务争抢 in-memory SQLite 连接锁。互斥/抢占的
    原子性由 transaction.atomic() + select_for_update 在代码层保证。
    """

    def setUp(self):
        BGMSyncSettings.get_solo()
        # 后台线程空转：不触达 DB / 网络，聚焦主线程抢占逻辑
        self._patch = patch("apps.goods.bgm_auto_sync._execute_job", lambda *a, **k: None)
        self._patch.start()
        self.addCleanup(self._patch.stop)

    def test_raises_when_recent_running_exists(self):
        _make_recent_running_job(trigger="manual")
        with self.assertRaises(RuntimeError):
            start_manual_sync(triggered_by=None)
        # 互斥失败时不应创建新 job
        self.assertEqual(BGMSyncJob.objects.filter(trigger="manual").count(), 1)

    def test_zombie_unblocks_manual_sync(self):
        # 僵尸任务存在，过去会永久挡死手动触发
        zombie = _make_old_running_job(trigger="manual")
        job = start_manual_sync(triggered_by=None)
        # 僵尸被回收
        zombie.refresh_from_db()
        self.assertEqual(zombie.status, "failed")
        # 新的 running job 已创建（_execute_job 被 patch 为空转，仍为 running）
        self.assertEqual(job.status, "running")
        self.assertEqual(job.trigger, "manual")

    def test_no_zombie_no_running_creates_job(self):
        # 正常路径：无 running 任务，直接创建并返回新 job
        job = start_manual_sync(triggered_by=None)
        self.assertEqual(job.status, "running")
        self.assertEqual(job.trigger, "manual")
