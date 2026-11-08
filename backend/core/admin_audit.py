"""Django Admin 站点写操作 → 统一操作日志桥接。

REST 后台（``/api/admin/*``）已经显式埋点，但 Django 自带 ``/admin/`` 站点的
增删改只会写 ``django_admin_log``，操作日志页面里看不到。这里幂等地包装
``ModelAdmin`` 的日志钩子，把同样的动作补写进 ``AdminAuditLog``。

注意：项目的 ``AUTH_USER_MODEL`` 仍是 ``auth.User``，与业务表 ``users.User``
主键空间不同，因此这里不写 ``actor`` 外键，只把 admin 账号名写进
``actor_username`` 与 ``changes``，避免审计行指向错误的业务用户。
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)

_INSTALLED_FLAG = "_admin_audit_bridge_installed"

# 单次批量删除最多记录的条目数，避免一次操作产生海量审计行
_MAX_DELETE_ENTRIES = 200


def _object_label(obj: Any) -> str:
    try:
        return str(obj)[:200]
    except Exception:  # noqa: BLE001 - 审计摘要不能因 __str__ 异常中断
        return "<无法显示>"


def _record(
    request,
    *,
    action: str,
    resource_id: str,
    summary: str,
    changes: dict[str, Any] | None = None,
) -> None:
    try:
        from apps.admin_api.services import record_admin_action

        admin_user = getattr(request, "user", None)
        payload = dict(changes or {})
        payload["django_admin_user_id"] = getattr(admin_user, "pk", None)
        record_admin_action(
            request,
            action=action,
            resource_type="django_admin",
            resource_id=resource_id,
            summary=summary,
            changes=payload,
            actor=None,
            actor_username=str(getattr(admin_user, "username", "") or ""),
            # /admin/ 登录的是 auth.User，主键与业务表 users.User 不同，
            # 绝不能把它的主键写进 actor 外键。
            resolve_actor=False,
        )
    except Exception:  # noqa: BLE001 - 审计失败不能影响 Django Admin 操作
        logger.exception("Unable to record Django Admin audit event")


def _install() -> None:
    from django.contrib.admin.options import ModelAdmin

    if getattr(ModelAdmin, _INSTALLED_FLAG, False):
        return

    original_add = ModelAdmin.log_addition
    original_change = ModelAdmin.log_change
    original_deletions = ModelAdmin.log_deletions

    def log_addition(self, request, obj, message):
        result = original_add(self, request, obj, message)
        _record(
            request,
            action="django_admin.add",
            resource_id=str(getattr(obj, "pk", "")),
            summary=f"Django Admin 新增 {obj._meta.verbose_name}：{_object_label(obj)}",
            changes={
                "model": f"{obj._meta.app_label}.{obj._meta.model_name}",
                "message": str(message),
            },
        )
        return result

    def log_change(self, request, obj, message):
        result = original_change(self, request, obj, message)
        _record(
            request,
            action="django_admin.change",
            resource_id=str(getattr(obj, "pk", "")),
            summary=f"Django Admin 修改 {obj._meta.verbose_name}：{_object_label(obj)}",
            changes={
                "model": f"{obj._meta.app_label}.{obj._meta.model_name}",
                "message": str(message),
            },
        )
        return result

    def log_deletions(self, request, queryset):
        # log_deletions 必须在删除前调用，这里先取快照再交给原实现。
        entries = [
            {
                "id": str(getattr(obj, "pk", "")),
                "label": _object_label(obj),
                "model": f"{obj._meta.app_label}.{obj._meta.model_name}",
            }
            for obj in queryset[:_MAX_DELETE_ENTRIES]
        ]
        result = original_deletions(self, request, queryset)
        for entry in entries:
            _record(
                request,
                action="django_admin.delete",
                resource_id=entry["id"],
                summary=f"Django Admin 删除：{entry['label']}",
                changes={"model": entry["model"]},
            )
        return result

    ModelAdmin.log_addition = log_addition
    ModelAdmin.log_change = log_change
    ModelAdmin.log_deletions = log_deletions
    setattr(ModelAdmin, _INSTALLED_FLAG, True)


def install_admin_site_audit() -> None:
    """在 AppConfig.ready() 中调用；幂等。"""
    try:
        _install()
    except Exception:  # noqa: BLE001 - 桥接失败不应阻止应用启动
        logger.exception("Unable to install Django Admin audit bridge")
