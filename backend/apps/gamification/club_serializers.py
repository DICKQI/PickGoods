from __future__ import annotations

from uuid import UUID, uuid4

from rest_framework import serializers

from apps.goods.models import Category, Character, ClubCatalogItem, IP, Theme

from .constants import REWARD_PRESET_KEYS
from .models import Achievement, AchievementSet, Reward
from .serializers import (
    AchievementAdminSerializer,
    AchievementSetAdminSerializer,
    RewardAdminSerializer,
    RuleConditionAdminSerializer,
    RuleGroupAdminSerializer,
)


CLUB_FILTER_KEYS = {
    "catalog_item_ids",
    "theme_ids",
    "ip_ids",
    "character_ids",
    "category_ids",
}


class ClubRuleConditionAdminSerializer(RuleConditionAdminSerializer):
    def validate_filters(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("筛选条件必须是对象")
        unknown = set(value) - CLUB_FILTER_KEYS
        if unknown:
            raise serializers.ValidationError(
                f"不支持的筛选字段：{', '.join(sorted(unknown))}"
            )

        normalized = {}
        club = self.context.get("club")
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
            missing = set(ids) - set(
                model.objects.filter(id__in=ids).values_list("id", flat=True)
            )
            if missing:
                raise serializers.ValidationError(
                    f"{key} 包含不存在的 ID：{sorted(missing)}"
                )
            normalized[key] = ids

        raw_theme_ids = value.get("theme_ids", [])
        if not isinstance(raw_theme_ids, list) or len(raw_theme_ids) > 100:
            raise serializers.ValidationError("theme_ids 必须是最多 100 项的数组")
        try:
            theme_ids = [int(item) for item in raw_theme_ids]
        except (TypeError, ValueError) as exc:
            raise serializers.ValidationError("theme_ids 只能包含整数 ID") from exc
        if club is not None:
            missing_themes = set(theme_ids) - set(
                Theme.objects.filter(id__in=theme_ids, user=club.user).values_list(
                    "id", flat=True
                )
            )
            if missing_themes:
                raise serializers.ValidationError(
                    f"theme_ids 包含非本社团主题：{sorted(missing_themes)}"
                )
        normalized["theme_ids"] = theme_ids

        raw_catalog_ids = value.get("catalog_item_ids", [])
        if not isinstance(raw_catalog_ids, list) or len(raw_catalog_ids) > 100:
            raise serializers.ValidationError(
                "catalog_item_ids 必须是最多 100 项的数组"
            )
        catalog_ids = []
        for raw_id in raw_catalog_ids:
            try:
                catalog_ids.append(str(UUID(str(raw_id))))
            except (TypeError, ValueError, AttributeError) as exc:
                raise serializers.ValidationError(
                    "catalog_item_ids 只能包含有效 UUID"
                ) from exc
        if club is not None:
            existing_catalog_ids = {
                str(value)
                for value in ClubCatalogItem.objects.filter(
                    id__in=catalog_ids,
                    club=club,
                ).values_list("id", flat=True)
            }
            missing_catalog = set(catalog_ids) - existing_catalog_ids
            if missing_catalog:
                raise serializers.ValidationError(
                    f"catalog_item_ids 包含非本社团商品：{sorted(missing_catalog)}"
                )
        normalized["catalog_item_ids"] = catalog_ids
        return normalized


class ClubRuleGroupAdminSerializer(RuleGroupAdminSerializer):
    conditions = ClubRuleConditionAdminSerializer(many=True)


class ClubAchievementSetSerializer(AchievementSetAdminSerializer):
    code = serializers.CharField(read_only=True)

    class Meta(AchievementSetAdminSerializer.Meta):
        read_only_fields = (
            *AchievementSetAdminSerializer.Meta.read_only_fields,
            "code",
        )

    def create(self, validated_data):
        club = self.context["club"]
        validated_data["club"] = club
        validated_data["code"] = f"club-{club.pk}-{uuid4().hex[:12]}"
        return super().create(validated_data)


class ClubAchievementSerializer(AchievementAdminSerializer):
    code = serializers.CharField(read_only=True)
    rule_groups = ClubRuleGroupAdminSerializer(many=True, allow_empty=False)

    class Meta(AchievementAdminSerializer.Meta):
        read_only_fields = (
            *AchievementAdminSerializer.Meta.read_only_fields,
            "code",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        club = self.context.get("club")
        if club is not None:
            self.fields["set"].queryset = AchievementSet.objects.filter(club=club)
            self.fields["rewards"].child_relation.queryset = Reward.objects.filter(
                club=club
            )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        club = self.context["club"]
        achievement_set = attrs.get(
            "set",
            getattr(self.instance, "set", None),
        )
        if achievement_set is None or achievement_set.club_id != club.id:
            raise serializers.ValidationError({"set": "必须选择本社团的成就系列"})
        rewards = attrs.get("rewards")
        if rewards is not None and any(reward.club_id != club.id for reward in rewards):
            raise serializers.ValidationError({"rewards": "只能关联本社团奖励"})
        return attrs

    def create(self, validated_data):
        club = self.context["club"]
        validated_data["code"] = f"club-{club.pk}-{uuid4().hex[:12]}"
        return super().create(validated_data)


class ClubRewardAdminSerializer(RewardAdminSerializer):
    code = serializers.CharField(read_only=True)

    class Meta(RewardAdminSerializer.Meta):
        read_only_fields = (
            *RewardAdminSerializer.Meta.read_only_fields,
            "code",
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        reward_type = attrs.get(
            "reward_type",
            getattr(self.instance, "reward_type", Reward.TYPE_BADGE),
        )
        preset_key = attrs.get(
            "preset_key",
            getattr(self.instance, "preset_key", ""),
        )
        if reward_type == Reward.TYPE_BADGE and preset_key:
            raise serializers.ValidationError(
                {"preset_key": "徽章不使用预设编码，请上传社团素材。"}
            )
        if (
            reward_type
            not in {
                Reward.TYPE_BADGE,
                Reward.TYPE_JOURNAL_STICKER_PACK,
            }
            and attrs.get("asset") is not None
        ):
            raise serializers.ValidationError(
                {"asset": "该奖励类型只能使用平台预设，不能上传主素材。"}
            )
        allowed_presets = REWARD_PRESET_KEYS.get(reward_type)
        if allowed_presets is not None and preset_key not in allowed_presets:
            raise serializers.ValidationError(
                {
                    "preset_key": (
                        f"{reward_type} 仅支持：{', '.join(sorted(allowed_presets))}"
                    )
                }
            )
        return attrs

    def create(self, validated_data):
        club = self.context["club"]
        validated_data["club"] = club
        validated_data["code"] = f"club-{club.pk}-{uuid4().hex[:12]}"
        return super().create(validated_data)
