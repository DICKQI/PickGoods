from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ClubFavorite, User


def _can_keep_favorite(user: User) -> bool:
    role_name = getattr(getattr(user, "role", None), "name", "")
    return (
        bool(user.is_active)
        and user.approval_status == User.APPROVAL_APPROVED
        and (user.account_type == User.ACCOUNT_TYPE_COLLECTOR or str(role_name).lower() == "admin")
    )


@receiver(post_save, sender=User)
def clear_invalid_club_favorites(sender, instance: User, **kwargs):
    """停用、待审或改变身份后，及时移除其收藏及其社团收到的收藏。"""
    if not _can_keep_favorite(instance):
        ClubFavorite.objects.filter(user_id=instance.id).delete()
    # 社团账号本身不是收藏人，但已审批且启用的社团仍然是有效收藏目标。
    # 只有社团失效或账号身份不再是社团时，才清理该社团收到的收藏。
    club_is_invalid = (
        instance.account_type != User.ACCOUNT_TYPE_CLUB
        or not instance.is_active
        or instance.approval_status != User.APPROVAL_APPROVED
    )
    if club_is_invalid:
        ClubFavorite.objects.filter(club__user_id=instance.id).delete()
