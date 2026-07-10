from django.db import models

from .catalog import IP


class BGMSyncSettings(models.Model):
    """全局 BGM 自动同步配置（单例：pk 固定为 1）。

    通过 ``BGMSyncSettings.get_solo()`` 获取唯一实例。
    """

    FREQUENCY_CHOICES = (
        ("daily", "每天"),
        ("every_3_days", "每3天"),
        ("weekly", "每周"),
    )

    auto_sync_enabled = models.BooleanField(
        default=False,
        verbose_name="自动同步开关",
        help_text="生产环境默认关闭。开启后调度器会按 frequency 周期触发同步。",
    )
    frequency = models.CharField(
        max_length=20,
        choices=FREQUENCY_CHOICES,
        default="weekly",
        verbose_name="同步频率",
    )
    last_run_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="上次执行时间",
    )
    next_run_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="下次执行时间",
        help_text="由调度器根据 last_run_at + frequency 自动计算",
    )
    concurrency_limit = models.IntegerField(
        default=1,
        verbose_name="并发上限",
        help_text="预留字段；当前实现为串行同步",
    )
    request_interval_ms = models.IntegerField(
        default=1500,
        verbose_name="IP 间请求间隔(ms)",
        help_text="礼貌地避免对 BGM API 过快请求",
    )
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    updated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="最近修改人",
    )

    class Meta:
        verbose_name = "BGM 同步配置"
        verbose_name_plural = "BGM 同步配置"

    def __str__(self):
        return f"BGMSyncSettings(enabled={self.auto_sync_enabled}, freq={self.frequency})"

    @classmethod
    def get_solo(cls) -> "BGMSyncSettings":
        """获取唯一配置实例（不存在则按默认值创建）。"""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class BGMSyncJob(models.Model):
    """一次 BGM 自动/手动同步任务的总记录（任务级审计）。"""

    TRIGGER_CHOICES = (
        ("scheduled", "定时调度"),
        ("manual", "手动触发"),
    )
    STATUS_CHOICES = (
        ("running", "执行中"),
        ("succeeded", "全部成功"),
        ("partial", "部分成功"),
        ("failed", "失败"),
        ("cancelled", "已取消"),
    )

    trigger = models.CharField(
        max_length=20,
        choices=TRIGGER_CHOICES,
        db_index=True,
        verbose_name="触发方式",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="running",
        db_index=True,
        verbose_name="任务状态",
    )
    started_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="开始时间")
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name="结束时间")
    triggered_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bgm_sync_jobs",
        verbose_name="触发人",
        help_text="手动触发时填，定时为 null",
    )
    total_ips = models.IntegerField(default=0, verbose_name="处理 IP 总数")
    success_count = models.IntegerField(default=0, verbose_name="成功数")
    failed_count = models.IntegerField(default=0, verbose_name="失败数")
    skipped_count = models.IntegerField(default=0, verbose_name="跳过数")
    created_total = models.IntegerField(default=0, verbose_name="新增角色合计")
    linked_total = models.IntegerField(default=0, verbose_name="回填 ID 合计")
    error_message = models.TextField(
        null=True,
        blank=True,
        verbose_name="顶层错误摘要",
        help_text="仅记录任务级别异常，单 IP 失败明细见 items",
    )

    class Meta:
        verbose_name = "BGM 同步任务"
        verbose_name_plural = "BGM 同步任务"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["trigger", "started_at"]),
            models.Index(fields=["status", "started_at"]),
        ]

    def __str__(self):
        return f"BGMSyncJob#{self.id}({self.trigger}/{self.status})"


class BGMSyncJobItem(models.Model):
    """单 IP 在某次同步任务中的明细。IP 删除后保留快照，便于审计。"""

    STATUS_CHOICES = (
        ("success", "成功"),
        ("no_change", "无变更"),
        ("skipped_unbound", "未绑定，跳过"),
        ("error", "失败"),
    )

    job = models.ForeignKey(
        BGMSyncJob,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="所属任务",
    )
    ip = models.ForeignKey(
        IP,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bgm_sync_items",
        verbose_name="对应 IP",
    )
    ip_name_snapshot = models.CharField(
        max_length=100,
        verbose_name="IP 名称快照",
        help_text="冗余保存，IP 被删除后仍可看名字",
    )
    bgm_subject_id = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="BGM 作品 ID 快照",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        db_index=True,
        verbose_name="处理结果",
    )
    created_count = models.IntegerField(default=0, verbose_name="本次新增角色数")
    linked_count = models.IntegerField(default=0, verbose_name="本次回填 ID 数")
    subject_type_updated = models.BooleanField(default=False, verbose_name="是否更新 subject_type")
    error_message = models.TextField(null=True, blank=True, verbose_name="错误信息")
    duration_ms = models.IntegerField(default=0, verbose_name="耗时(ms)")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="记录时间")

    class Meta:
        verbose_name = "BGM 同步明细"
        verbose_name_plural = "BGM 同步明细"
        ordering = ["id"]
        indexes = [
            models.Index(fields=["job", "status"]),
        ]

    def __str__(self):
        return f"{self.job_id} - {self.ip_name_snapshot} - {self.status}"
