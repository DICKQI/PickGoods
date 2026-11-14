"""业务开关（轻量 feature flag）。

只做一件事：把设置项收敛成一个可测试的函数，避免各视图直接读 ``settings``。
新增开关请沿用 ``<name>_enabled()`` 的命名，并在 ``backend/api.md`` 里记一笔。

``PERSONAL_IP_ENABLED`` 是个人 IP 的 T0 回滚开关：置为 0（``false``/``False``）
后，普通账号对 IP / 角色的写操作一律 403，且所有 IP / 角色查询只返回官方数据，
个人数据保留在库里但完全不可见。详见 ``docs/personal-ip-rollback.md``。
"""
from __future__ import annotations

from django.conf import settings

_FALSY = {"0", "false", "no", "off"}


def _env_flag(name: str, default: str = "1") -> bool:
    raw = getattr(settings, name, default)
    if isinstance(raw, bool):
        return raw
    return str(raw).strip().lower() not in _FALSY


def personal_ip_enabled() -> bool:
    """个人 IP（用户自建、仅本人可见）是否开放。"""
    return _env_flag("PERSONAL_IP_ENABLED", "1")
