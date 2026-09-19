from __future__ import annotations

import datetime as dt
import decimal
import logging
from typing import Any, Iterable

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
    "file",
    "image",
    "avatar",
)


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


def record_admin_action(
    request,
    *,
    action: str,
    resource_type: str,
    resource_id: str | int | None,
    summary: str,
    changes: dict[str, Any] | None = None,
) -> AdminAuditLog | AdminAuditRetry | None:
    actor = getattr(request, "user", None)
    if not getattr(actor, "is_authenticated", False):
        actor = None
    payload = {
        "actor_id": getattr(actor, "pk", None),
        "action": action,
        "resource_type": resource_type,
        "resource_id": "" if resource_id is None else str(resource_id),
        "summary": summary[:500],
        "changes": sanitize_audit_value(changes or {}),
        "ip_address": client_ip(request),
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
    values = {
        "actor": actor,
        "action": payload["action"],
        "resource_type": payload["resource_type"],
        "resource_id": payload.get("resource_id", ""),
        "summary": payload.get("summary", "")[:500],
        "changes": payload.get("changes") or {},
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


def purge_admin_audit_logs(retention_days: int = 365) -> int:
    cutoff = timezone.now() - dt.timedelta(days=max(1, int(retention_days)))
    deleted, _ = AdminAuditLog.objects.filter(created_at__lt=cutoff).delete()
    retry_deleted, _ = AdminAuditRetry.objects.filter(
        resolved_at__isnull=False,
        resolved_at__lt=cutoff,
    ).delete()
    deleted += retry_deleted
    return deleted
