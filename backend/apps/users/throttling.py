from __future__ import annotations

import hashlib
from collections.abc import Mapping

from rest_framework.exceptions import ParseError, UnsupportedMediaType
from rest_framework.throttling import SimpleRateThrottle


class IPRateThrottle(SimpleRateThrottle):
    """Throttle anonymous auth endpoints by client IP, even with a JWT."""

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        if not ident:
            return None
        return self.cache_format % {"scope": self.scope, "ident": ident}


class RegisterRateThrottle(IPRateThrottle):
    scope = "auth_register"


class LoginIPRateThrottle(IPRateThrottle):
    scope = "auth_login"


class LoginUsernameRateThrottle(SimpleRateThrottle):
    scope = "auth_login_username"

    def get_cache_key(self, request, view):
        try:
            data = request.data
        except (ParseError, UnsupportedMediaType):
            return None
        if not isinstance(data, Mapping):
            return None
        username = str(data.get("username") or "").strip().casefold()
        if not username:
            return None
        ident = hashlib.sha256(username.encode("utf-8")).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": ident}


class CaptchaRateThrottle(IPRateThrottle):
    scope = "auth_captcha"


class CaptchaImageRateThrottle(IPRateThrottle):
    scope = "auth_captcha_image"
