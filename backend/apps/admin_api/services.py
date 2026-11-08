from __future__ import annotations

import datetime as dt
import decimal
import logging
from typing import Any, Iterable

from django.conf import settings
from django.db import models
from django.db import transaction
from django.utils import timezone

from .models import AdminAuditLog, AdminAuditRetry

logger = logging.getLogger(__name__)


_SENSITIVE_KEY_PARTS = (
    "password",
    "token",
    "secret",
    "authorization",
    "cookie",
    "session",
    "csrf",
    "api_key",
    "apikey",
    "private_key",
    "raw_body",
)

DEFAULT_AUDIT_RETENTION_DAYS = 365


def sanitize_audit_value(value: Any) -> Any:
    """Convert values to JSON-safe primitives and redact sensitive fields."""

    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, (dt.date, dt.datetime, dt.time)):
        return value.isoformat()
    if isinstance(value, dict):
        return {
            str(key): (
                "[REDACTED]"
                if any(part in str(key).lower() for part in _SENSITIVE_KEY_PARTS)
                else sanitize_audit_value(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [sanitize_audit_value(item) for item in value]
    if isinstance(value, models.Model):
        return {
            "id": str(value.pk),
            "label": str(value),
        }
    return str(value)


def snapshot_instance(instance: Any, fields: Iterable[str]) -> dict[str, Any]:
    return {
        field: sanitize_audit_value(getattr(instance, field, None))
        for field in fields
    }


def client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def request_context(request) -> dict[str, Any]:
    """提取请求上下文，供审计行统一落库。"""
    if request is None:
        return {
            "http_method": "",
            "path": "",
            "request_id": "",
            "user_agent": "",
            "ip_address": None,
        }
    meta = getattr(request, "META", {}) or {}
    method = str(getattr(request, "method", "") or "")[:10]
    path = str(getattr(request, "path", "") or "")[:500]
    request_id = str(meta.get("HTTP_X_REQUEST_ID", "") or "")[:64]
    user_agent = str(meta.get("HTTP_USER_AGENT", "") or "")[:300]
    return {
        "http_method": method,
        "path": path,
        "request_id": request_id,
        "user_agent": user_agent,
        "ip_address": client_ip(request),
    }


def normalize_resource_ids(ids: Iterable[Any] | None) -> str:
    """把批量操作的 ID 列表规范化为 ``",1,2,3,"``，便于按单个资源反查。

    幂等：传入已规范化的字符串（如 ``",1,2,"``）不会按字符拆分。
    """
    if not ids:
        return ""
    if isinstance(ids, str):
        candidates: Iterable[Any] = ids.split(",")
    else:
        candidates = ids
    normalized: list[str] = []
    seen: set[str] = set()
    for value in candidates:
        text = str(value).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        normalized.append(text)
    if not normalized:
        return ""
    return "," + ",".join(normalized) + ","


def _resolve_actor(request):
    actor = getattr(request, "user", None) if request is not None else None
    if not getattr(actor, "is_authenticated", False):
        return None
    return actor


def record_admin_action(
    request,
    *,
    action: str,
    resource_type: str,
    resource_id: str | int | None,
    summary: str,
    changes: dict[str, Any] | None = None,
    subject_user: Any = None,
    resource_ids: Iterable[Any] | None = None,
    log_type: str = AdminAuditLog.LOG_TYPE_BUSINESS,
    outcome: str = AdminAuditLog.OUTCOME_SUCCESS,
    status_code: int | None = None,
    actor: Any = None,
    actor_username: str | None = None,
    resolve_actor: bool = True,
) -> AdminAuditLog | AdminAuditRetry | None:
    """写入一条管理员操作审计；失败时转入持久化重试队列，绝不阻断业务。

    ``actor`` 可显式传入，用于 ``request.user`` 为匿名（登录失败等）的场景。
    ``actor_username`` 可显式覆盖，用于 Django Admin 场景：站点登录的是
    ``auth.User``，与业务表 ``users.User`` 主键空间不同，只能记录账号名。
    ``resolve_actor=False`` 时不从 ``request.user`` 推断操作人，避免把
    ``auth.User`` 的主键写进 ``users.User`` 外键。
    """
    resolved_actor = actor
    if resolved_actor is None and resolve_actor:
        resolved_actor = _resolve_actor(request)
    if resolved_actor is not None and not getattr(resolved_actor, "is_authenticated", False):
        resolved_actor = None
    context = request_context(request)
    if actor_username is None:
        actor_username = str(getattr(resolved_actor, "username", "") or "")
    payload = {
        "actor_id": getattr(resolved_actor, "pk", None),
        "actor_username": str(actor_username or "")[:150],
        "subject_user_id": getattr(subject_user, "pk", None),
        "action": action,
        "resource_type": resource_type,
        "resource_id": "" if resource_id is None else str(resource_id),
        "resource_ids": normalize_resource_ids(resource_ids),
        "summary": summary[:500],
        "changes": sanitize_audit_value(changes or {}),
        "log_type": log_type,
        "outcome": outcome,
        "status_code": status_code,
        **context,
    }
    try:
        with transaction.atomic():
            return AdminAuditLog.objects.create(**payload)
    except Exception as exc:  # noqa: BLE001 - audit must not break business writes
        logger.exception("Unable to persist admin audit log")
        try:
            with transaction.atomic():
                return AdminAuditRetry.objects.create(
                    payload=payload,
                    next_attempt_at=timezone.now(),
                    last_error=str(exc),
                )
        except Exception:  # noqa: BLE001 - best-effort retry persistence
            logger.exception("Unable to persist admin audit retry")
            return None


def audit_admin_action(request, **kwargs) -> AdminAuditLog | AdminAuditRetry | None:
    """仅在当前请求由管理员发起时记录，否则静默跳过。

    用于复用业务接口里的管理员分支，避免每处都写 ``if is_admin(...)``。
    """
    from core.permissions import is_admin

    actor = kwargs.pop("actor", None) or _resolve_actor(request)
    if actor is None or not is_admin(actor):
        return None
    return record_admin_action(request, actor=actor, **kwargs)


def record_security_event(
    request,
    *,
    action: str,
    summary: str,
    outcome: str = AdminAuditLog.OUTCOME_FAILURE,
    actor: Any = None,
    subject_user: Any = None,
    changes: dict[str, Any] | None = None,
    resource_type: str = "auth",
    resource_id: str | int | None = None,
    status_code: int | None = None,
    actor_username: str | None = None,
) -> AdminAuditLog | AdminAuditRetry | None:
    """记录安全事件（登录、改密、越权尝试、限流等）。"""
    return record_admin_action(
        request,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        summary=summary,
        changes=changes,
        subject_user=subject_user,
        log_type=AdminAuditLog.LOG_TYPE_SECURITY,
        outcome=outcome,
        status_code=status_code,
        actor=actor,
        actor_username=actor_username,
    )


def _write_audit_payload(
    payload: dict[str, Any],
    *,
    idempotency_key: str | None = None,
) -> AdminAuditLog:
    actor_id = payload.get("actor_id")
    actor = None
    if actor_id is not None:
        from apps.users.models import User

        actor = User.objects.filter(pk=actor_id).first()
    subject_user_id = payload.get("subject_user_id")
    subject_user = None
    if subject_user_id is not None:
        from apps.users.models import User

        subject_user = User.objects.filter(pk=subject_user_id).first()
    values = {
        "actor": actor,
        "actor_username": payload.get("actor_username", "")[:150],
        "subject_user": subject_user,
        "action": payload["action"],
        "resource_type": payload["resource_type"],
        "resource_id": payload.get("resource_id", ""),
        "resource_ids": payload.get("resource_ids", ""),
        "summary": payload.get("summary", "")[:500],
        "changes": payload.get("changes") or {},
        "log_type": payload.get("log_type", AdminAuditLog.LOG_TYPE_BUSINESS),
        "outcome": payload.get("outcome", AdminAuditLog.OUTCOME_SUCCESS),
        "http_method": payload.get("http_method", "")[:10],
        "path": payload.get("path", "")[:500],
        "status_code": payload.get("status_code"),
        "request_id": payload.get("request_id", "")[:64],
        "user_agent": payload.get("user_agent", "")[:300],
        "ip_address": payload.get("ip_address"),
    }
    if idempotency_key:
        log, _ = AdminAuditLog.objects.get_or_create(
            idempotency_key=idempotency_key,
            defaults=values,
        )
        return log
    return AdminAuditLog.objects.create(**values)


def retry_admin_audit_queue(limit: int = 100) -> int:
    now = timezone.now()
    with transaction.atomic():
        tasks = list(
            AdminAuditRetry.objects.select_for_update()
            .filter(resolved_at__isnull=True, next_attempt_at__lte=now)
            .order_by("next_attempt_at", "id")[:limit]
        )
        resolved = 0
        for task in tasks:
            try:
                with transaction.atomic():
                    _write_audit_payload(
                        task.payload,
                        idempotency_key=f"admin-audit-retry:{task.pk}",
                    )
            except Exception as exc:  # noqa: BLE001 - retried again by scheduler
                task.attempts += 1
                delay_minutes = min(60, 2 ** min(task.attempts, 6))
                task.next_attempt_at = timezone.now() + dt.timedelta(
                    minutes=delay_minutes
                )
                task.last_error = str(exc)
                task.save(
                    update_fields=[
                        "attempts",
                        "next_attempt_at",
                        "last_error",
                        "updated_at",
                    ]
                )
            else:
                task.resolved_at = timezone.now()
                task.last_error = ""
                task.save(
                    update_fields=["resolved_at", "last_error", "updated_at"]
                )
                resolved += 1
    return resolved


def audit_retention_days() -> int:
    """审计保留天数，可通过 ``ADMIN_AUDIT_RETENTION_DAYS`` 覆盖。"""
    return max(
        1,
        int(
            getattr(
                settings,
                "ADMIN_AUDIT_RETENTION_DAYS",
                DEFAULT_AUDIT_RETENTION_DAYS,
            )
        ),
    )


def purge_admin_audit_logs(retention_days: int | None = None) -> int:
    if retention_days is None:
        retention_days = audit_retention_days()
    cutoff = timezone.now() - dt.timedelta(days=max(1, int(retention_days)))
    # 只追加模型禁止默认管理器删除，保留期清理走 all_objects。
    deleted, _ = AdminAuditLog.all_objects.filter(created_at__lt=cutoff).delete()
    retry_deleted, _ = AdminAuditRetry.all_objects.filter(
        resolved_at__isnull=False,
        resolved_at__lt=cutoff,
    ).delete()
    deleted += retry_deleted
    return deleted
