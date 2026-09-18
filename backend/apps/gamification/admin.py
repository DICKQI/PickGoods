from django.contrib import admin

from .models import (
    Achievement,
    AchievementSet,
    GamificationConfig,
    MetricEvent,
    MetricSyncFailure,
    MetricSourceState,
    PublicBadgeSelection,
    Reward,
    RewardAsset,
    RuleCondition,
    RuleGroup,
    UserAchievement,
    UserEquippedReward,
    UserReward,
)


class RuleConditionInline(admin.TabularInline):
    model = RuleCondition
    extra = 0


class RuleGroupInline(admin.TabularInline):
    model = RuleGroup
    extra = 0


@admin.register(GamificationConfig)
class GamificationConfigAdmin(admin.ModelAdmin):
    list_display = ("id", "rollout_at", "initialized_at", "updated_at")


@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "reward_type", "rarity", "is_active", "order")
    list_filter = ("reward_type", "rarity", "is_active")
    search_fields = ("code", "name", "preset_key")


@admin.register(RewardAsset)
class RewardAssetAdmin(admin.ModelAdmin):
    list_display = ("reward", "name", "order", "created_at")
    search_fields = ("reward__name", "name")


@admin.register(AchievementSet)
class AchievementSetAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_limited", "is_active", "starts_at", "ends_at", "order")
    list_filter = ("is_limited", "is_active")
    search_fields = ("code", "name")


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "set", "root_operator", "is_active", "is_limited", "order")
    list_filter = ("set", "is_active", "is_limited", "root_operator")
    search_fields = ("code", "name")
    filter_horizontal = ("rewards",)
    inlines = (RuleGroupInline,)


@admin.register(MetricEvent)
class MetricEventAdmin(admin.ModelAdmin):
    list_display = ("user", "event_type", "amount", "source_type", "source_id", "occurred_at")
    list_filter = ("event_type", "source_type", "occurred_at")
    search_fields = ("user__username", "source_id", "idempotency_key")
    readonly_fields = (
        "user",
        "event_type",
        "amount",
        "source_type",
        "source_id",
        "metadata",
        "occurred_at",
        "idempotency_key",
        "created_at",
    )


@admin.register(MetricSourceState)
class MetricSourceStateAdmin(admin.ModelAdmin):
    list_display = (
        "source_type",
        "source_id",
        "user",
        "observed_quantity",
        "accrued_quantity",
        "observed_spend",
        "accrued_spend",
        "updated_at",
    )
    list_filter = ("source_type",)
    search_fields = ("user__username", "source_id")


@admin.register(MetricSyncFailure)
class MetricSyncFailureAdmin(admin.ModelAdmin):
    list_display = ("source_type", "source_id", "attempts", "last_attempt_at", "resolved_at")
    list_filter = ("source_type", "resolved_at")
    search_fields = ("source_id", "error_message")


@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ("user", "achievement", "status", "progress_percent", "unlocked_at", "claimed_at")
    list_filter = ("status", "achievement__set")
    search_fields = ("user__username", "achievement__name")


@admin.register(UserReward)
class UserRewardAdmin(admin.ModelAdmin):
    list_display = ("user", "reward", "source_achievement", "granted_at")
    search_fields = ("user__username", "reward__name")


@admin.register(UserEquippedReward)
class UserEquippedRewardAdmin(admin.ModelAdmin):
    list_display = ("user", "slot", "reward", "equipped_at")
    list_filter = ("slot",)


@admin.register(PublicBadgeSelection)
class PublicBadgeSelectionAdmin(admin.ModelAdmin):
    list_display = ("user", "reward", "order", "created_at")
    search_fields = ("user__username", "reward__name")
