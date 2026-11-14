"""谷子模块的限流器。"""
from __future__ import annotations

from rest_framework.throttling import SimpleRateThrottle


class BGMPersonalThrottle(SimpleRateThrottle):
    """按用户限制个人 Bangumi 调用频率（用户自带 token，但要保护服务器出口）。"""

    scope = "bgm_personal"

    def get_cache_key(self, request, view):
        user_id = getattr(getattr(request, "user", None), "id", None)
        if not user_id:
            return None
        return self.cache_format % {"scope": self.scope, "ident": user_id}
