from __future__ import annotations

from django.db import models


class AdminAuditLog(models.Model):
    """Immutable audit record for sensitive administrator operations."""

    actor = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_audit_logs",
        verbose_name="操作管理员",
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

    class Meta:
        verbose_name = "管理员操作日志"
        verbose_name_plural = "管理员操作日志"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["resource_type", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self) -> str:
        actor = self.actor.username if self.actor_id else "已删除管理员"
        return f"{actor} {self.action} {self.resource_type}:{self.resource_id}"


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

    class Meta:
        verbose_name = "管理员审计重试"
        verbose_name_plural = "管理员审计重试"
        ordering = ["resolved_at", "next_attempt_at", "id"]
        indexes = [
            models.Index(fields=["resolved_at", "next_attempt_at"]),
        ]

    def __str__(self) -> str:
        return f"audit-retry:{self.pk}"
