from __future__ import annotations

from django.db import models


class AppendOnlyQuerySet(models.QuerySet):
    """审计日志只允许追加：禁止批量更新与删除。

    保留期清理等确需删除的场景请显式使用 ``AdminAuditLog.all_objects``。
    """

    def update(self, **kwargs):  # noqa: D102 - 明确拒绝
        raise RuntimeError("审计日志只允许追加，禁止批量更新；请使用 all_objects 进行维护操作。")

    def delete(self):  # noqa: D102 - 明确拒绝
        raise RuntimeError("审计日志只允许追加，禁止删除；请使用 all_objects 进行维护操作。")


class AppendOnlyManager(models.Manager.from_queryset(AppendOnlyQuerySet)):
    """默认管理器：写入与查询正常，批量改删被拒绝。"""


class AdminAuditLog(models.Model):
    """Immutable audit record for sensitive administrator operations."""

    LOG_TYPE_BUSINESS = "business"
    LOG_TYPE_SECURITY = "security"
    LOG_TYPE_CHOICES = (
        (LOG_TYPE_BUSINESS, "业务操作"),
        (LOG_TYPE_SECURITY, "安全事件"),
    )

    OUTCOME_SUCCESS = "success"
    OUTCOME_FAILURE = "failure"
    OUTCOME_CHOICES = (
        (OUTCOME_SUCCESS, "成功"),
        (OUTCOME_FAILURE, "失败"),
    )

    actor = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_audit_logs",
        verbose_name="操作管理员",
    )
    actor_username = models.CharField(
        max_length=150,
        blank=True,
        default="",
        verbose_name="操作人用户名快照",
        help_text="操作人账号被删除后仍可读；Django Admin 场景下记录 admin 账号名。",
    )
    log_type = models.CharField(
        max_length=20,
        choices=LOG_TYPE_CHOICES,
        default=LOG_TYPE_BUSINESS,
        db_index=True,
        verbose_name="日志类型",
    )
    outcome = models.CharField(
        max_length=10,
        choices=OUTCOME_CHOICES,
        default=OUTCOME_SUCCESS,
        db_index=True,
        verbose_name="操作结果",
    )
    action = models.CharField(max_length=100, db_index=True, verbose_name="动作")
    resource_type = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="资源类型",
    )
    resource_id = models.CharField(
        max_length=100,
        blank=True,
        default="",
        db_index=True,
        verbose_name="资源 ID",
    )
    resource_ids = models.TextField(
        blank=True,
        default="",
        verbose_name="资源 ID 集合",
        help_text="批量操作的规范化 ID 串，形如 \",1,2,3,\"，用于按单个资源反查。",
    )
    subject_user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_audit_subjects",
        verbose_name="数据归属用户",
        help_text="被操作数据的归属用户（社团/吃谷人），用于按用户聚合审计。",
    )
    summary = models.CharField(max_length=500, verbose_name="摘要")
    changes = models.JSONField(default=dict, blank=True, verbose_name="脱敏变更")
    idempotency_key = models.CharField(
        max_length=100,
        unique=True,
        null=True,
        blank=True,
        default=None,
        verbose_name="幂等键",
    )
    http_method = models.CharField(
        max_length=10,
        blank=True,
        default="",
        verbose_name="请求方法",
    )
    path = models.CharField(
        max_length=500,
        blank=True,
        default="",
        verbose_name="请求路径",
    )
    status_code = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="响应状态码",
    )
    request_id = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
        verbose_name="请求 ID",
    )
    user_agent = models.CharField(
        max_length=300,
        blank=True,
        default="",
        verbose_name="User-Agent",
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="来源 IP",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="操作时间",
    )

    # objects 只允许追加；all_objects 供保留期清理与数据维护使用。
    objects = AppendOnlyManager()
    all_objects = models.Manager()

    class Meta:
        verbose_name = "管理员操作日志"
        verbose_name_plural = "管理员操作日志"
        ordering = ["-created_at", "-id"]
        base_manager_name = "all_objects"
        default_manager_name = "objects"
        indexes = [
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["resource_type", "created_at"]),
            models.Index(fields=["action", "created_at"]),
            models.Index(fields=["log_type", "created_at"]),
            models.Index(fields=["subject_user", "created_at"]),
            models.Index(fields=["outcome", "created_at"]),
        ]

    def __str__(self) -> str:
        actor = self.actor_username or (
            self.actor.username if self.actor_id else "已删除管理员"
        )
        return f"{actor} {self.action} {self.resource_type}:{self.resource_id}"

    def delete(self, *args, **kwargs):  # noqa: D102 - 只追加
        raise RuntimeError(
            "审计日志只允许追加，禁止删除；保留期清理请使用 AdminAuditLog.all_objects。"
        )

    def save(self, *args, **kwargs):
        """允许创建与幂等写入，但禁止改写既有记录。"""
        allow_update = kwargs.pop("_audit_allow_update", False)
        if self.pk is not None and not allow_update:
            raise RuntimeError("审计日志只允许追加，禁止修改已写入的记录。")
        return super().save(*args, **kwargs)


class AdminAuditRetry(models.Model):
    """Durable retry queue for admin audit writes that failed transiently."""

    payload = models.JSONField(default=dict, verbose_name="审计载荷")
    attempts = models.PositiveIntegerField(default=0, verbose_name="重试次数")
    next_attempt_at = models.DateTimeField(db_index=True, verbose_name="下次重试时间")
    last_error = models.TextField(blank=True, default="", verbose_name="最近错误")
    resolved_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="解决时间",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    # 重试队列需要被清理，因此额外提供 all_objects 别名，保持调用侧一致。
    objects = models.Manager()
    all_objects = models.Manager()

    class Meta:
        verbose_name = "管理员审计重试"
        verbose_name_plural = "管理员审计重试"
        ordering = ["resolved_at", "next_attempt_at", "id"]
        indexes = [
            models.Index(fields=["resolved_at", "next_attempt_at"]),
        ]

    def __str__(self) -> str:
        return f"audit-retry:{self.pk}"
