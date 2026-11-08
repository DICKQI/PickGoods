"""DRF 统一异常处理：在默认处理之后补记安全事件审计。

只记录 ``/api/`` 下的 401 / 403 / 429，且审计写入失败绝不影响原始响应。
"""

from __future__ import annotations

import logging

from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)

# 仅这些状态码视为需要留痕的安全事件
_SECURITY_STATUS_ACTIONS = {
    401: ("security.unauthenticated", "未认证访问"),
    403: ("security.permission_denied", "权限被拒绝"),
    429: ("security.throttled", "触发限流"),
}


def _should_record(request) -> bool:
    path = str(getattr(request, "path", "") or "")
    return path.startswith("/api/")


def _throttle_scope(exc) -> str:
    for attr in ("throttle_scope", "scope"):
        value = getattr(exc, attr, None)
        if value:
            return str(value)
    detail = getattr(exc, "detail", None)
    if isinstance(detail, dict):
        scope = detail.get("scope")
        if scope:
            return str(scope)
    return ""


def audit_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return response

    request = context.get("request") if isinstance(context, dict) else None
    if request is None or not _should_record(request):
        return response

    mapped = _SECURITY_STATUS_ACTIONS.get(response.status_code)
    if mapped is None:
        return response

    action, label = mapped
    view = context.get("view") if isinstance(context, dict) else None
    view_name = type(view).__name__ if view is not None else ""
    changes = {
        "method": str(getattr(request, "method", "") or ""),
        "path": str(getattr(request, "path", "") or ""),
        "view": view_name,
    }
    if response.status_code == 429:
        scope = _throttle_scope(exc)
        if scope:
            changes["scope"] = scope

    try:
        from apps.admin_api.services import record_security_event

        record_security_event(
            request,
            action=action,
            summary=f"{label}：{changes['method']} {changes['path']}".strip(),
            changes=changes,
            status_code=response.status_code,
        )
    except Exception:  # noqa: BLE001 - 审计失败不能影响原始响应
        logger.exception("Unable to record security audit event")

    return response
