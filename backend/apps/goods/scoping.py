"""个人 IP 的可见性 / 可写性规则。

IP 与 Character 两个视图集共用同一套判断，避免规则漂移：

- **官方域**（``IP.user`` 为空）：所有登录账号可见，只有管理员可写；
- **个人域**（``IP.user`` 非空）：只有归属者本人可见可写；
- **管理员没有前台特权**：前台一律「官方 IP + 自己的个人 IP」。他人创建的个人
  IP / 角色对管理员同样不可见（按 ID 请求返回 404），避免前台页面变成半成品
  的管理后台；运营排查走 ``/api/admin/ips/``、Django admin 或
  ``purge_personal_ips`` 命令；
- **开关关闭**（``PERSONAL_IP_ENABLED=0``，T0 回滚）：个人数据对所有人不可见，
  普通账号的写操作一律被拒。数据仍完整保留，改回开关即可恢复。
"""
from __future__ import annotations

from django.db.models import Q

from core.permissions import is_admin

from .feature_flags import personal_ip_enabled


def visible_ip_filter(user) -> Q:
    """当前用户可见的 IP 范围（配合 ``IP.objects.filter(...)`` 使用）。

    官方 IP 对全员可见；个人 IP 只对归属者本人可见。管理员的个人域与他人个人
    IP 同样不可见——官方域的写权限不等于个人域的可读权限。
    """
    if not personal_ip_enabled():
        return Q(user__isnull=True)
    user_id = getattr(user, "id", None)
    if not user_id:
        return Q(user__isnull=True)
    return Q(user__isnull=True) | Q(user_id=user_id)


def visible_character_filter(user) -> Q:
    """当前用户可见的角色范围（配合 ``Character.objects.filter(...)`` 使用）。"""
    if not personal_ip_enabled():
        return Q(ip__user__isnull=True)
    user_id = getattr(user, "id", None)
    if not user_id:
        return Q(ip__user__isnull=True)
    return Q(ip__user__isnull=True) | Q(ip__user_id=user_id)


def can_manage_ip(user, ip) -> bool:
    """当前用户是否可写该 IP（以及它下面的角色）。

    - 官方 IP：只有管理员可写；
    - 个人 IP：只有归属者本人可写（管理员按普通用户处理，需先自己创建）；
    - 开关关闭时个人 IP 一律不可写（官方 IP 仍由管理员维护）。
    """
    owner_id = getattr(ip, "user_id", None)
    if owner_id is None:
        return is_admin(user)
    if not personal_ip_enabled():
        return False
    user_id = getattr(user, "id", None)
    return bool(user_id) and owner_id == user_id


def writable_ip_queryset(user):
    """可作为角色归属的 IP 集合。

    - 管理员：官方 IP + 自己名下的个人 IP（官方 IP 的角色由其维护）；
    - 普通账号：只有自己的个人 IP（官方 IP 的角色仍由管理员维护）；
    - 开关关闭：非管理员一律为空集。
    """
    from .models import IP

    queryset = IP.objects.all()
    user_id = getattr(user, "id", None)
    if not user_id:
        return queryset.none()
    if is_admin(user):
        return queryset.filter(Q(user__isnull=True) | Q(user_id=user_id))
    if not personal_ip_enabled():
        return queryset.none()
    return queryset.filter(user_id=user_id)
