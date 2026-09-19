from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Max, Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.goods.models import ClubGoodsOrigin
from core.permissions import IsAdmin, IsCollectorAccount
from apps.users.models import User

from .models import (
    Achievement,
    AchievementSet,
    MetricEvent,
    Reward,
    RewardAsset,
    UserAchievement,
    UserEquippedReward,
    UserReward,
)
from .serializers import (
    AchievementAdminSerializer,
    AchievementSetAdminSerializer,
    AdminUserProgressSerializer,
    EquipmentSerializer,
    EquipmentUpdateSerializer,
    PublicBadgeUpdateSerializer,
    RewardAdminSerializer,
    RewardAssetUploadSerializer,
    RewardSerializer,
    UserAchievementSerializer,
    UserRewardSerializer,
)
from .services import (
    claim_achievement,
    equip_reward,
    is_feature_enabled,
    mark_achievements_seen,
    set_public_badges,
)
from .services import public_badges_for_user


def _metric_summary(user) -> dict:
    qs = MetricEvent.objects.filter(user=user)
    goods_events = qs.filter(event_type=MetricEvent.EVENT_GOODS_QUANTITY)
    spend_events = qs.filter(event_type=MetricEvent.EVENT_SPEND_AMOUNT)
    altar_events = qs.filter(event_type=MetricEvent.EVENT_VALID_ALTAR)
    goods_quantity = sum((event.amount for event in goods_events), Decimal("0.00"))
    spend_amount = sum((event.amount for event in spend_events), Decimal("0.00"))
    altar_count = len(
        {
            str(event.metadata.get("character_id"))
            for event in altar_events
            if event.metadata.get("character_id") is not None
        }
    )
    ip_ids = {
        event.metadata.get("ip_id")
        for event in goods_events
        if event.metadata.get("ip_id") is not None
    }
    character_ids = {
        character_id
        for event in goods_events
        for character_id in event.metadata.get("character_ids", [])
        if character_id is not None
    }
    return {
        "goods_quantity": float(goods_quantity),
        "valid_altars": altar_count,
        "spend_amount": float(spend_amount),
        "distinct_ip_count": len(ip_ids),
        "distinct_character_count": len(character_ids),
        "event_count": qs.count(),
    }


def _published_rewards(user, request):
    participating_club_ids = set(
        ClubGoodsOrigin.objects.filter(
            collector=user,
            club__isnull=False,
        ).values_list("club_id", flat=True)
    )
    grants = {
        grant.reward_id: grant
        for grant in UserReward.objects.filter(user=user).select_related("source_achievement")
    }
    payload = []
    reward_qs = (
        Reward.objects.filter(
            Q(club__isnull=True, is_active=True)
            | Q(
                club_id__in=participating_club_ids,
                is_active=True,
                achievements__is_active=True,
                achievements__set__is_active=True,
            )
            | Q(user_grants__user=user)
        )
        .select_related("club")
        .prefetch_related("assets")
        .distinct()
    )
    for reward in reward_qs:
        item = RewardSerializer(reward, context={"request": request}).data
        grant = grants.get(reward.id)
        source_achievement = grant.source_achievement if grant else reward.achievements.filter(is_active=True).first()
        item["owned"] = grant is not None
        item["granted_at"] = grant.granted_at if grant else None
        item["source_achievement"] = (
            {
                "id": source_achievement.id,
                "name": source_achievement.name,
            }
            if source_achievement
            else None
        )
        payload.append(item)
    return payload


class SummaryView(APIView):
    permission_classes = [IsAuthenticated, IsCollectorAccount]

    def get(self, request):
        enabled = is_feature_enabled()
        states = (
            UserAchievement.objects.filter(user=request.user)
            .select_related("achievement", "achievement__set")
            .order_by("-updated_at")
        )
        recent = (
            states.exclude(status=UserAchievement.STATUS_LOCKED)
            .filter(unlocked_at__isnull=False)
            .order_by("-unlocked_at")
            .first()
        )
        equipment = UserEquippedReward.objects.filter(
            user=request.user,
        ).select_related("reward", "reward__club")
        return Response(
            {
                "enabled": enabled,
                "metrics": _metric_summary(request.user),
                "unseen_count": states.filter(unseen=True).count(),
                "recent_unlocked": (
                    {
                        "id": recent.id,
                        "achievement_id": recent.achievement_id,
                        "name": recent.achievement.name,
                        "set_name": recent.achievement.set.name,
                        "unlocked_at": recent.unlocked_at,
                    }
                    if recent
                    else None
                ),
                "equipment": EquipmentSerializer(equipment, many=True, context={"request": request}).data,
                "public_badge_ids": list(
                    public_badges_for_user(request.user.id).values_list("reward_id", flat=True)
                ),
            }
        )


class OverviewView(APIView):
    permission_classes = [IsAuthenticated, IsCollectorAccount]

    def get(self, request):
        enabled = is_feature_enabled()
        if not enabled:
            return Response(
                {
                    "enabled": False,
                    "metrics": _metric_summary(request.user),
                    "achievements": [],
                }
            )
        participating_club_ids = set(
            ClubGoodsOrigin.objects.filter(
                collector=request.user,
                club__isnull=False,
            ).values_list("club_id", flat=True)
        )
        states = (
            UserAchievement.objects.filter(user=request.user)
            .filter(
                Q(
                    achievement__set__club__isnull=True,
                    achievement__is_active=True,
                    achievement__set__is_active=True,
                )
                | Q(
                    achievement__set__club_id__in=participating_club_ids,
                    achievement__is_active=True,
                    achievement__set__is_active=True,
                )
                | ~Q(status=UserAchievement.STATUS_LOCKED)
            )
            .select_related(
                "achievement",
                "achievement__set",
                "achievement__set__club",
            )
            .prefetch_related(
                Prefetch(
                    "achievement__rewards",
                    queryset=Reward.objects.select_related("club").prefetch_related(
                        "assets"
                    ),
                )
            )
            .order_by("achievement__set__order", "achievement__order", "id")
        )
        return Response(
            {
                "enabled": True,
                "metrics": _metric_summary(request.user),
                "achievements": UserAchievementSerializer(states, many=True, context={"request": request}).data,
            }
        )


class RewardListView(APIView):
    permission_classes = [IsAuthenticated, IsCollectorAccount]

    def get(self, request):
        return Response({"results": _published_rewards(request.user, request) if is_feature_enabled() else []})


class ClaimAchievementView(APIView):
    permission_classes = [IsAuthenticated, IsCollectorAccount]

    def post(self, request, pk):
        try:
            state, grants = claim_achievement(request.user, pk)
        except UserAchievement.DoesNotExist:
            return Response({"detail": "成就不存在"}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "achievement": UserAchievementSerializer(state, context={"request": request}).data,
                "rewards": UserRewardSerializer(grants, many=True, context={"request": request}).data,
            }
        )


class EquipmentView(APIView):
    permission_classes = [IsAuthenticated, IsCollectorAccount]

    def get(self, request):
        equipment = UserEquippedReward.objects.filter(
            user=request.user,
        ).select_related("reward")
        return Response({"results": EquipmentSerializer(equipment, many=True, context={"request": request}).data})

    def put(self, request):
        serializer = EquipmentUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            equipment = equip_reward(
                request.user,
                serializer.validated_data["slot"],
                serializer.validated_data.get("reward_id"),
            )
        except Reward.DoesNotExist:
            return Response({"detail": "奖励不存在"}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"equipment": EquipmentSerializer(equipment, context={"request": request}).data if equipment else None}
        )


class PublicBadgesView(APIView):
    permission_classes = [IsAuthenticated, IsCollectorAccount]

    def get(self, request):
        selections = public_badges_for_user(request.user.id)
        return Response(
            {
                "results": [
                    {
                        "id": item.id,
                        "order": item.order,
                        "reward": RewardSerializer(item.reward, context={"request": request}).data,
                    }
                    for item in selections
                ]
            }
        )

    def put(self, request):
        serializer = PublicBadgeUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            selections = set_public_badges(request.user, serializer.validated_data["reward_ids"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "results": [
                    {
                        "id": item.id,
                        "order": item.order,
                        "reward": RewardSerializer(item.reward, context={"request": request}).data,
                    }
                    for item in selections
                ]
            }
        )


class SeenView(APIView):
    permission_classes = [IsAuthenticated, IsCollectorAccount]

    def post(self, request):
        return Response({"updated": mark_achievements_seen(request.user)})


class GamificationAdminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class AdminAchievementSetViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = GamificationAdminPagination
    queryset = AchievementSet.objects.annotate(achievement_count=Count("achievements")).order_by("order", "id")
    serializer_class = AchievementSetAdminSerializer
    search_fields = ["code", "name", "description"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if UserAchievement.objects.filter(achievement__set=instance).exists():
            return Response(
                {"detail": "该系列已有用户进度，不能删除；请停用系列以保留历史成果。"},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class AdminAchievementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = GamificationAdminPagination
    queryset = (
        Achievement.objects.select_related("set")
        .prefetch_related("rewards", "rule_groups__conditions")
        .annotate(user_count=Count("user_states", distinct=True))
        .order_by("set__order", "order", "id")
    )
    serializer_class = AchievementAdminSerializer
    search_fields = ["code", "name", "set__name"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        set_id = self.request.query_params.get("set")
        if set_id:
            qs = qs.filter(set_id=set_id)
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            qs = qs.filter(is_active=active == "true")
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user_states.exists():
            return Response(
                {"detail": "该成就已有用户进度，不能删除；请停用成就以保留历史成果。"},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class AdminRewardViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = GamificationAdminPagination
    queryset = Reward.objects.prefetch_related("assets").annotate(
        achievement_count=Count("achievements", distinct=True)
    ).order_by("order", "id")
    serializer_class = RewardAdminSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    search_fields = ["code", "name", "description", "preset_key"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        reward_type = self.request.query_params.get("reward_type")
        if reward_type:
            qs = qs.filter(reward_type=reward_type)
        active = self.request.query_params.get("is_active")
        if active in {"true", "false"}:
            qs = qs.filter(is_active=active == "true")
        return qs

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user_grants.exists():
            return Response(
                {"detail": "该奖励已发放给用户，不能删除；请停用奖励以保留已装备内容。"},
                status=status.HTTP_409_CONFLICT,
            )
        if instance.achievements.exists():
            return Response(
                {"detail": "该奖励仍被成就引用，请先解除关联或停用奖励。"},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="assets", parser_classes=[MultiPartParser, FormParser])
    def upload_asset(self, request, pk=None):
        reward = self.get_object()
        serializer = RewardAssetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        asset = RewardAsset.objects.create(
            reward=reward,
            name=serializer.validated_data["name"],
            image=serializer.validated_data["image"],
            order=serializer.validated_data.get("order", 0),
        )
        return Response(
            {
                "id": asset.id,
                "name": asset.name,
                "image_url": request.build_absolute_uri(asset.image.url),
                "order": asset.order,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"assets/(?P<asset_id>[^/.]+)",
    )
    def delete_asset(self, request, pk=None, asset_id=None):
        reward = self.get_object()
        asset = get_object_or_404(RewardAsset, pk=asset_id, reward=reward)
        asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminUserProgressViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = GamificationAdminPagination
    serializer_class = AdminUserProgressSerializer
    search_fields = ["username"]

    def get_queryset(self):
        return User.objects.filter(account_type="collector").order_by("id")

    def _serialize_user(self, user):
        states = UserAchievement.objects.filter(user=user)
        return {
            "id": user.id,
            "username": user.username,
            "event_count": MetricEvent.objects.filter(user=user).count(),
            "achievement_count": states.exclude(status=UserAchievement.STATUS_LOCKED).count(),
            "claimed_count": states.filter(status=UserAchievement.STATUS_CLAIMED).count(),
            "metrics": _metric_summary(user),
            "updated_at": states.aggregate(value=Max("updated_at"))["value"],
        }

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            data = [self._serialize_user(user) for user in page]
            return self.get_paginated_response(data)
        return Response([self._serialize_user(user) for user in queryset])

    def retrieve(self, request, *args, **kwargs):
        user = self.get_object()
        return Response(self._serialize_user(user))
