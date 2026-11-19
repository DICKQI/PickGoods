"""个人 Bangumi Access Token 的解析规则。

设计要点：普通用户只能用自己的 token；管理员优先用自己的，未设置时回落到
服务端的环境变量 token（保持既有行为）。绝不用别人的 token 代跑请求。
"""
from __future__ import annotations

from rest_framework.exceptions import APIException

from core.permissions import is_admin

from .bgm_service import ACCESS_TOKEN

TOKEN_MISSING_DETAIL = "请先在个人中心填写 Bangumi Access Token 后再使用 Bangumi 功能"


class BGMTokenMissing(APIException):
    """当前账号缺少可用的 Bangumi Access Token。

    响应体为 ``{"detail": ..., "code": "bgm_token_missing"}``，前端据此把用户
    引导到个人中心填写 token（而不是弹一个笼统的 400）。
    """

    status_code = 400
    default_code = "bgm_token_missing"

    def __init__(self):
        super().__init__({"detail": TOKEN_MISSING_DETAIL, "code": self.default_code})


def mask_token(token: str | None) -> str | None:
    """把 token 变成 ``****abcd`` 形式，用于回显。"""
    if not token:
        return None
    suffix = token[-4:] if len(token) > 4 else ""
    return f"****{suffix}"


def resolve_bgm_token(user) -> str | None:
    """返回本次请求应使用的 token；没有可用 token 时返回 None。"""
    personal = (getattr(user, "bgm_access_token", "") or "").strip()
    if personal:
        return personal
    if is_admin(user):
        # 管理员沿用服务端环境变量里的 token（历史行为）
        return (ACCESS_TOKEN or "").strip() or None
    return None


def require_bgm_token(user) -> str | None:
    """返回本次请求应使用的 token。

    - 普通账号：必须已配置个人 token，否则抛 400（前端引导去个人中心填写）；
    - 管理员：优先个人 token，否则回落服务端 token；两者都没有时返回 None，
      沿用历史上的匿名请求行为（BGM 的公开条目接口无需鉴权）。
    """
    token = resolve_bgm_token(user)
    if token is None and not is_admin(user):
        raise BGMTokenMissing()
    return token
