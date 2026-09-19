from __future__ import annotations

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.goods.models import ClubGoodsOrigin
from apps.users.models import Club, User
from core.permissions import IsClubAccount

from .club_serializers import (
    ClubAchievementSerializer,
    ClubAchievementSetSerializer,
    ClubRewardAdminSerializer,
)
from .models import (
    Achievement,
    AchievementSet,
    Reward,
    RewardAsset,
    UserAchievement,
    UserReward,
)
from .serializers import (
    AchievementSetSerializer,
    ClubSummarySerializer,
    RewardAssetUploadSerializer,
    RewardSerializer,
)
from .services import is_feature_enabled


def _current_club(user):
    club = (
        Club.objects.select_related("user")
        .filter(
            user=user,
            user__account_type=User.ACCOUNT_TYPE_CLUB,
            user__approval_status=User.APPROVAL_APPROVED,
            user__is_active=True,
            deleted_at__isnull=True,
        )
        .first()
    )
    if club is None:
        raise PermissionDenied("当前账号没有可用的社团资料")
    return club


def _public_club_queryset():
    return Club.objects.select_related("user").filter(
        user__account_type=User.ACCOUNT_TYPE_CLUB,
        user__approval_status=User.APPROVAL_APPROVED,
        user__is_active=True,
        deleted_at__isnull=True,
    )


class ClubGamificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class ClubScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsClubAccount]
    pagination_class = ClubGamificationPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_club(self):
        if not hasattr(self, "_club"):
            self._club = _current_club(self.request.user)
        return self._club

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["club"] = self.get_club()
        return context


class ClubAchievementSetViewSet(ClubScopedViewSet):
    serializer_class = ClubAchievementSetSerializer
    search_fields = ["code", "name", "description"]

    def get_queryset(self):
        return (
            AchievementSet.objects.filter(club=self.get_club())
            .select_related("club")
            .annotate(
                achievement_count=Count("achievements", distinct=True),
                unlocked_count=Count(
                    "achievements__user_states",
                    filter=Q(
                        achievements__user_states__status__in=[
                            UserAchievement.STATUS_UNLOCKED,
                            UserAchievement.STATUS_CLAIMED,
                        ]
                    ),
                    distinct=True,
                ),
                claimed_count=Count(
                    "achievements__user_states",
                    filter=Q(
                        achievements__user_states__status=UserAchievement.STATUS_CLAIMED
                    ),
                    distinct=True,
                ),
            )
            .order_by("order", "id")
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if UserAchievement.objects.filter(achievement__set=instance).exists():
            return Response(
                {
                    "detail": (
                        "该系列已有用户进度，不能删除；请停用以保留历史成果。"
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class ClubAchievementViewSet(ClubScopedViewSet):
    serializer_class = ClubAchievementSerializer
    search_fields = ["code", "name", "set__name"]

    def get_queryset(self):
        club = self.get_club()
        return (
            Achievement.objects.filter(set__club=club)
            .select_related("set", "set__club")
            .prefetch_related("rewards", "rule_groups__conditions")
            .annotate(user_count=Count("user_states", distinct=True))
            .order_by("set__order", "order", "id")
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user_states.exists():
            return Response(
                {
                    "detail": "该成就已有用户进度，不能删除；请停用以保留历史成果。"
                },
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class ClubRewardViewSet(ClubScopedViewSet):
    serializer_class = ClubRewardAdminSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    search_fields = ["code", "name", "description", "preset_key"]

    def get_queryset(self):
        return (
            Reward.objects.filter(club=self.get_club())
            .select_related("club")
            .prefetch_related("assets")
            .annotate(achievement_count=Count("achievements", distinct=True))
            .order_by("order", "id")
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.user_grants.exists():
            return Response(
                {
                    "detail": (
                        "该奖励已发放给用户，不能删除；请停用以保留已装备内容。"
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        if instance.achievements.exists():
            return Response(
                {"detail": "该奖励仍被成就引用，请先解除关联或停用奖励。"},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["post"],
        url_path="assets",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_asset(self, request, pk=None):
        reward = self.get_object()
        if reward.reward_type not in {
            Reward.TYPE_BADGE,
            Reward.TYPE_JOURNAL_STICKER_PACK,
        }:
            return Response(
                {"detail": "该奖励类型不支持上传社团素材。"},
                status=status.HTTP_400_BAD_REQUEST,
            )
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


class PublicClubGamificationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk):
        club = get_object_or_404(_public_club_queryset(), pk=pk)
        if not is_feature_enabled():
            return Response(
                {
                    "enabled": False,
                    "club": ClubSummarySerializer(
                        club,
                        context={"request": request},
                    ).data,
                    "participation": False,
                    "sets": [],
                }
            )

        states = {}
        participation = False
        if (
            getattr(request.user, "is_authenticated", False)
            and getattr(request.user, "account_type", None)
            == User.ACCOUNT_TYPE_COLLECTOR
        ):
            states = {
                state.achievement_id: state
                for state in UserAchievement.objects.filter(
                    user=request.user,
                    achievement__set__club=club,
                )
            }
            participation = ClubGoodsOrigin.objects.filter(
                club=club,
                collector=request.user,
            ).exists()

        now = timezone.now()
        sets = (
            AchievementSet.objects.filter(club=club, is_active=True)
            .select_related("club")
            .prefetch_related(
                "achievements__rewards",
                "achievements__rewards__assets",
            )
            .order_by("order", "id")
        )
        payload = []
        for achievement_set in sets:
            if achievement_set.is_limited and (
                achievement_set.starts_at is None
                or achievement_set.ends_at is None
                or achievement_set.starts_at > now
                or achievement_set.ends_at <= now
            ):
                continue
            achievements = []
            for achievement in achievement_set.achievements.all():
                if (
                    not achievement.is_active
                    or achievement.first_published_at is None
                ):
                    continue
                state = states.get(achievement.id)
                rewards = RewardSerializer(
                    [
                        reward
                        for reward in achievement.rewards.all()
                        if reward.is_active
                        or (
                            state
                            and state.status
                            in {
                                UserAchievement.STATUS_UNLOCKED,
                                UserAchievement.STATUS_CLAIMED,
                            }
                        )
                    ],
                    many=True,
                    context={"request": request},
                ).data
                item = {
                    "id": achievement.id,
                    "code": achievement.code,
                    "name": achievement.name,
                    "description": achievement.description,
                    "is_limited": achievement.is_limited,
                    "first_published_at": achievement.first_published_at,
                    "rewards": rewards,
                    "status": state.status if state else None,
                    "progress": state.progress if state else None,
                    "progress_percent": (
                        state.progress_percent if state else None
                    ),
                    "unlocked_at": state.unlocked_at if state else None,
                    "claimed_at": state.claimed_at if state else None,
                    "can_claim": bool(
                        state
                        and state.status == UserAchievement.STATUS_UNLOCKED
                    ),
                }
                achievements.append(item)
            if achievements:
                payload.append(
                    {
                        **AchievementSetSerializer(
                            achievement_set,
                            context={"request": request},
                        ).data,
                        "achievements": achievements,
                    }
                )
        return Response(
            {
                "enabled": True,
                "club": ClubSummarySerializer(
                    club,
                    context={"request": request},
                ).data,
                "participation": participation,
                "sets": payload,
            }
        )
