from django.conf import settings
from django.db.models import QuerySet

from .models import GamificationConfig, PublicBadgeSelection, Reward, UserReward


def gamification_runtime_enabled() -> bool:
    if not getattr(settings, "GAMIFICATION_ENABLED", False):
        return False
    return GamificationConfig.objects.filter(pk=1, rollout_at__isnull=False).exists()


def owned_reward_queryset(user_id: int) -> QuerySet[Reward]:
    return Reward.objects.filter(user_grants__user_id=user_id).distinct()


def user_owns_reward(user_id: int, reward_id: int, *, require_active: bool = True) -> bool:
    qs = UserReward.objects.filter(user_id=user_id, reward_id=reward_id)
    if require_active:
        qs = qs.filter(reward__is_active=True)
    return qs.exists()


def public_badge_queryset(user_id: int):
    if not gamification_runtime_enabled():
        return PublicBadgeSelection.objects.none()
    return (
        PublicBadgeSelection.objects.filter(
            user_id=user_id,
            reward__reward_type=Reward.TYPE_BADGE,
            reward__user_grants__user_id=user_id,
        )
        .select_related("reward", "reward__club")
        .distinct()
        .order_by("order", "id")
    )
