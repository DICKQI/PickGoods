"""个人 IP 的可见性 / 可写性规则。

IP 与 Character 两个视图集共用同一套判断，避免规则漂移：

- **官方域**（``IP.user`` 为空）：所有登录账号可见，只有管理员可写；
- **个人域**（``IP.user`` 非空）：只有本人可见可写；管理员可见（便于排查）也可写；
- **开关关闭**（``PERSONAL_IP_ENABLED=0``，T0 回滚）：个人数据对所有人不可见，
  普通账号的写操作一律被拒。数据仍完整保留，改回开关即可恢复。
"""
from __future__ import annotations

from django.db.models import Q

from core.permissions import is_admin

from .feature_flags import personal_ip_enabled


def visible_ip_filter(user) -> Q:
    """当前用户可见的 IP 范围（配合 ``IP.objects.filter(...)`` 使用）。"""
    if not personal_ip_enabled():
        return Q(user__isnull=True)
    if is_admin(user):
        return Q()
    return Q(user__isnull=True) | Q(user=user)


def visible_character_filter(user) -> Q:
    """当前用户可见的角色范围（配合 ``Character.objects.filter(...)`` 使用）。"""
    if not personal_ip_enabled():
        return Q(ip__user__isnull=True)
    if is_admin(user):
        return Q()
    return Q(ip__user__isnull=True) | Q(ip__user=user)


def can_manage_ip(user, ip) -> bool:
    """当前用户是否可写该 IP（以及它下面的角色）。

    管理员对任何 IP 都为真；普通账号只能写自己的个人 IP；开关关闭时一律为假。
    """
    if is_admin(user):
        return True
    if not personal_ip_enabled():
        return False
    user_id = getattr(user, "id", None)
    return bool(user_id) and getattr(ip, "user_id", None) == user_id


def writable_ip_queryset(user):
    """可作为角色归属的 IP 集合（非管理员只能选自己的个人 IP）。"""
    from .models import IP

    queryset = IP.objects.all()
    if is_admin(user):
        return queryset
    if not personal_ip_enabled():
        return queryset.none()
    return queryset.filter(user=user)
