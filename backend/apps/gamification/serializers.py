from __future__ import annotations

from collections import Counter

from django.db import transaction
from rest_framework import serializers

from apps.goods.models import Category, Character, IP

from .constants import REWARD_PRESET_KEYS
from .models import (
    Achievement,
    AchievementSet,
    Reward,
    RewardAsset,
    RuleCondition,
    RuleGroup,
    UserAchievement,
    UserEquippedReward,
    UserReward,
)


class ClubSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    avatar = serializers.ImageField(allow_null=True)


class RewardAssetSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(read_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = RewardAsset
        fields = ("id", "name", "image", "image_url", "order", "created_at")
        read_only_fields = ("id", "image", "image_url", "created_at")

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


class RewardSerializer(serializers.ModelSerializer):
    asset_url = serializers.SerializerMethodField()
    assets = RewardAssetSerializer(many=True, read_only=True)
    club = ClubSummarySerializer(read_only=True)
    owner_type = serializers.SerializerMethodField()

    class Meta:
        model = Reward
        fields = (
            "id",
            "code",
            "club",
            "owner_type",
            "name",
            "description",
            "reward_type",
            "rarity",
            "asset_url",
            "preset_key",
            "is_active",
            "assets",
            "order",
        )

    def get_asset_url(self, obj):
        if not obj.asset:
            return None
        request = self.context.get("request")
        url = obj.asset.url
        return request.build_absolute_uri(url) if request else url

    def get_owner_type(self, obj):
        return "club" if obj.club_id else "platform"


class AchievementSetSerializer(serializers.ModelSerializer):
    club = ClubSummarySerializer(read_only=True)
    owner_type = serializers.SerializerMethodField()

    class Meta:
        model = AchievementSet
        fields = (
            "id",
            "code",
            "club",
            "owner_type",
            "name",
            "description",
            "badge_label",
            "starts_at",
            "ends_at",
            "is_limited",
            "is_active",
            "order",
        )

    def get_owner_type(self, obj):
        return "club" if obj.club_id else "platform"


class UserAchievementSerializer(serializers.ModelSerializer):
    achievement = serializers.SerializerMethodField()
    rewards = RewardSerializer(source="achievement.rewards", many=True, read_only=True)

    class Meta:
        model = UserAchievement
        fields = (
            "id",
            "achievement",
            "status",
            "progress",
            "progress_percent",
            "unlocked_at",
            "claimed_at",
            "unseen",
            "rewards",
        )

    def get_achievement(self, obj):
        achievement = obj.achievement
        return {
            "id": achievement.id,
            "code": achievement.code,
            "name": achievement.name,
            "description": achievement.description,
            "root_operator": achievement.root_operator,
            "is_limited": achievement.is_limited,
            "set": AchievementSetSerializer(
                achievement.set,
                context=self.context,
            ).data,
        }


class UserRewardSerializer(serializers.ModelSerializer):
    reward = RewardSerializer(read_only=True)
    source_achievement = serializers.SerializerMethodField()

    class Meta:
        model = UserReward
        fields = ("id", "reward", "source_achievement", "granted_at")

    def get_source_achievement(self, obj):
        if not obj.source_achievement_id:
            return None
        return {
            "id": obj.source_achievement_id,
            "code": obj.source_achievement.code,
            "name": obj.source_achievement.name,
        }


class EquipmentSerializer(serializers.ModelSerializer):
    reward = RewardSerializer(read_only=True)

    class Meta:
        model = UserEquippedReward
        fields = ("id", "slot", "reward", "equipped_at")


class EquipmentUpdateSerializer(serializers.Serializer):
    slot = serializers.ChoiceField(choices=UserEquippedReward.SLOT_CHOICES)
    reward_id = serializers.IntegerField(required=False, allow_null=True)


class PublicBadgeUpdateSerializer(serializers.Serializer):
    reward_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=True,
        max_length=3,
    )


class RuleConditionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = RuleCondition
        fields = ("id", "metric", "threshold", "filters", "order")

    def validate_threshold(self, value):
        if value <= 0:
            raise serializers.ValidationError("目标值必须大于 0")
        return value

    def validate_filters(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("筛选条件必须是对象")
        allowed_keys = {"ip_ids", "character_ids", "category_ids", "is_official"}
        unknown = set(value) - allowed_keys
        if unknown:
            raise serializers.ValidationError(f"不支持的筛选字段：{', '.join(sorted(unknown))}")
        normalized = {}
        id_models = {
            "ip_ids": IP,
            "character_ids": Character,
            "category_ids": Category,
        }
        for key, model in id_models.items():
            raw_values = value.get(key, [])
            if not isinstance(raw_values, list) or len(raw_values) > 100:
                raise serializers.ValidationError(f"{key} 必须是最多 100 项的数组")
            try:
                ids = [int(item) for item in raw_values]
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError(f"{key} 只能包含整数 ID") from exc
            missing = set(ids) - set(model.objects.filter(id__in=ids).values_list("id", flat=True))
            if missing:
                raise serializers.ValidationError(f"{key} 包含不存在的 ID：{sorted(missing)}")
            normalized[key] = ids
        official_values = value.get("is_official", [])
        if not isinstance(official_values, list) or any(type(item) is not bool for item in official_values):
            raise serializers.ValidationError("is_official 只能包含布尔值")
        normalized["is_official"] = official_values
        return normalized


class RuleGroupAdminSerializer(serializers.ModelSerializer):
    conditions = RuleConditionAdminSerializer(many=True)

    class Meta:
        model = RuleGroup
        fields = ("id", "operator", "order", "conditions")

    def validate_conditions(self, value):
        if not value:
            raise serializers.ValidationError("规则组至少需要一个条件")
        return value


class AchievementAdminSerializer(serializers.ModelSerializer):
    rule_groups = RuleGroupAdminSerializer(many=True, allow_empty=False)
    rewards = serializers.PrimaryKeyRelatedField(
        queryset=Reward.objects.all(),
        many=True,
        required=False,
    )
    set_name = serializers.CharField(source="set.name", read_only=True)
    user_count = serializers.IntegerField(source="user_states.count", read_only=True)

    class Meta:
        model = Achievement
        fields = (
            "id",
            "code",
            "set",
            "set_name",
            "name",
            "description",
            "root_operator",
            "is_active",
            "is_limited",
            "order",
            "first_published_at",
            "rewards",
            "rule_groups",
            "user_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "first_published_at",
            "created_at",
            "updated_at",
            "set_name",
            "user_count",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["set"].queryset = AchievementSet.objects.filter(club__isnull=True)
        self.fields["rewards"].child_relation.queryset = Reward.objects.filter(
            club__isnull=True
        )

    def validate(self, attrs):
        instance = self.instance
        achievement_set = attrs.get("set", getattr(instance, "set", None))
        rewards = attrs.get("rewards")
        effective_rewards = (
            rewards
            if rewards is not None
            else list(instance.rewards.all())
            if instance is not None
            else []
        )
        if achievement_set is not None:
            expected_club_id = achievement_set.club_id
            if any(reward.club_id != expected_club_id for reward in effective_rewards):
                raise serializers.ValidationError(
                    {"rewards": "只能关联与成就系列归属相同的奖励。"}
                )
        if instance and instance.user_states.exists():
            immutable = {}
            if "code" in attrs and attrs["code"] != instance.code:
                immutable["code"] = "已有用户进度后不能修改编码"
            groups = attrs.get("rule_groups")
            if groups is not None:
                metrics = {
                    condition["metric"]
                    for group in groups
                    for condition in group.get("conditions", [])
                }
                old_metrics = Counter(
                    RuleCondition.objects.filter(group__achievement=instance).values_list("metric", flat=True)
                )
                new_metrics = Counter(
                    condition["metric"]
                    for group in groups
                    for condition in group.get("conditions", [])
                )
                if new_metrics != old_metrics:
                    immutable["rule_groups"] = "已有用户进度后不能修改指标类型"
            if immutable:
                raise serializers.ValidationError(immutable)
            if "rewards" in attrs:
                old_reward_ids = set(instance.rewards.values_list("id", flat=True))
                new_reward_ids = {reward.id for reward in attrs["rewards"]}
                if old_reward_ids != new_reward_ids:
                    raise serializers.ValidationError(
                        {"rewards": "已有用户进度后不能修改奖励集合。"}
                    )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        groups_data = validated_data.pop("rule_groups", [])
        rewards = validated_data.pop("rewards", [])
        validated_data["is_limited"] = bool(validated_data["set"].is_limited)
        achievement = Achievement.objects.create(**validated_data)
        self._replace_groups(achievement, groups_data)
        achievement.rewards.set(rewards)
        return achievement

    @transaction.atomic
    def update(self, instance, validated_data):
        groups_data = validated_data.pop("rule_groups", None)
        rewards = validated_data.pop("rewards", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.is_limited = bool(instance.set.is_limited)
        instance.save()
        if groups_data is not None:
            self._replace_groups(instance, groups_data)
        if rewards is not None:
            instance.rewards.set(rewards)
        return instance

    def _replace_groups(self, achievement, groups_data):
        achievement.rule_groups.all().delete()
        for group_index, group_data in enumerate(groups_data):
            conditions_data = group_data.pop("conditions", [])
            group = RuleGroup.objects.create(
                achievement=achievement,
                operator=group_data.get("operator", RuleGroup.OPERATOR_ALL),
                order=group_data.get("order", group_index),
            )
            for condition_index, condition_data in enumerate(conditions_data):
                RuleCondition.objects.create(
                    group=group,
                    metric=condition_data["metric"],
                    threshold=condition_data["threshold"],
                    filters=condition_data.get("filters", {}),
                    order=condition_data.get("order", condition_index),
                )


class AchievementSetAdminSerializer(serializers.ModelSerializer):
    achievement_count = serializers.IntegerField(source="achievements.count", read_only=True)
    club = ClubSummarySerializer(read_only=True)
    owner_type = serializers.SerializerMethodField()
    unlocked_count = serializers.IntegerField(read_only=True)
    claimed_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = AchievementSet
        fields = (
            "id",
            "code",
            "club",
            "owner_type",
            "name",
            "description",
            "badge_label",
            "starts_at",
            "ends_at",
            "is_limited",
            "is_active",
            "order",
            "achievement_count",
            "unlocked_count",
            "claimed_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "club",
            "owner_type",
            "achievement_count",
            "unlocked_count",
            "claimed_count",
            "created_at",
            "updated_at",
        )

    def get_owner_type(self, obj):
        return "club" if obj.club_id else "platform"

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        is_limited = attrs.get("is_limited", getattr(self.instance, "is_limited", False))
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({"ends_at": "结束时间必须晚于开始时间"})
        if is_limited and (not starts_at or not ends_at):
            raise serializers.ValidationError("限时活动必须同时设置开始和结束时间")
        if not is_limited and (starts_at or ends_at):
            raise serializers.ValidationError("永久成就不应设置活动时间窗")
        if (
            self.instance
            and "code" in attrs
            and attrs["code"] != self.instance.code
            and self.instance.achievements.filter(user_states__isnull=False).exists()
        ):
            raise serializers.ValidationError({"code": "已有用户进度后不能修改系列编码"})
        return attrs


class RewardAdminSerializer(RewardSerializer):
    achievement_count = serializers.IntegerField(source="achievements.count", read_only=True)
    club = ClubSummarySerializer(read_only=True)

    class Meta(RewardSerializer.Meta):
        fields = (
            "id",
            "code",
            "club",
            "owner_type",
            "name",
            "description",
            "reward_type",
            "rarity",
            "asset",
            "asset_url",
            "preset_key",
            "assets",
            "is_active",
            "order",
            "achievement_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "club",
            "owner_type",
            "asset_url",
            "assets",
            "achievement_count",
            "created_at",
            "updated_at",
        )

    def validate_preset_key(self, value):
        return (value or "").strip()

    def validate(self, attrs):
        reward_type = attrs.get("reward_type", getattr(self.instance, "reward_type", ""))
        preset_key = attrs.get("preset_key", getattr(self.instance, "preset_key", ""))
        allowed_presets = REWARD_PRESET_KEYS.get(reward_type)
        if allowed_presets is not None and preset_key not in allowed_presets:
            raise serializers.ValidationError(
                {"preset_key": f"{reward_type} 仅支持：{', '.join(sorted(allowed_presets))}"}
            )
        if (
            self.instance
            and (
                self.instance.user_grants.exists()
                or self.instance.achievements.filter(user_states__isnull=False).exists()
            )
        ):
            frozen_fields = {}
            if "code" in attrs and attrs["code"] != self.instance.code:
                frozen_fields["code"] = "奖励已有用户记录后不能修改编码。"
            if reward_type != self.instance.reward_type:
                frozen_fields["reward_type"] = "奖励已有用户记录后不能修改类型。"
            if preset_key != self.instance.preset_key:
                frozen_fields["preset_key"] = "奖励已有用户记录后不能修改预设。"
            if frozen_fields:
                raise serializers.ValidationError(frozen_fields)
        return attrs


class RewardAssetUploadSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    image = serializers.ImageField()
    order = serializers.IntegerField(required=False, default=0)


class AdminUserProgressSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    event_count = serializers.IntegerField()
    achievement_count = serializers.IntegerField()
    claimed_count = serializers.IntegerField()
    metrics = serializers.DictField()
    updated_at = serializers.DateTimeField(allow_null=True)
