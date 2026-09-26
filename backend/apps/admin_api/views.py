from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Cast, Coalesce, TruncDate
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, mixins, serializers, status, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.decorators import (
    action,
    api_view,
    permission_classes as permission_classes_decorator,
)
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from apps.goods.models import (
    BGMSyncJob,
    BGMSyncJobItem,
    BGMSyncSettings,
    Category,
    Character,
    Goods,
    GoodsCraft,
    IP,
    Theme,
)
from apps.users.models import Role, User
from core.permissions import IsAdmin

from .filters import (
    AdminAuditLogFilter,
    AdminCategoryFilter,
    AdminCharacterFilter,
    AdminGoodsFilter,
    AdminGoodsCraftFilter,
    AdminIPFilter,
    AdminThemeFilter,
    AdminUserFilter,
)
from .models import AdminAuditLog, AdminAuditRetry
from .serializers import (
    AdminAuditLogSerializer,
    AdminBulkActionSerializer,
    AdminCategoryListSerializer,
    AdminCharacterListSerializer,
    AdminGoodsCraftSerializer,
    AdminGoodsListSerializer,
    AdminIPListSerializer,
    AdminRoleSerializer,
    AdminThemeListSerializer,
    AdminUserCreateSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    BGMSyncJobDetailSerializer,
    BGMSyncJobItemSerializer,
    BGMSyncJobListSerializer,
    BGMSyncSettingsSerializer,
)
from .services import record_admin_action, snapshot_instance


class AdminPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


@extend_schema_view(
    list=extend_schema(
        responses={200: OpenApiResponse(AdminUserSerializer(many=True))},
    ),
    retrieve=extend_schema(
        responses={200: OpenApiResponse(AdminUserSerializer())},
    ),
    create=extend_schema(
        request=AdminUserCreateSerializer,
        responses={201: OpenApiResponse(AdminUserSerializer())},
    ),
    update=extend_schema(
        request=AdminUserUpdateSerializer,
        responses={200: OpenApiResponse(AdminUserSerializer())},
    ),
    partial_update=extend_schema(
        request=AdminUserUpdateSerializer,
        responses={200: OpenApiResponse(AdminUserSerializer())},
    ),
)
@extend_schema(
    tags=["Admin"],
    summary="管理员：用户列表与账号维护",
    description=(
        "仅 `role.name` 为 Admin 的账号可访问。\n\n"
        "- 支持分页：`?page=`、`?page_size=`（最大 100）。\n"
        "- 支持搜索：`?search=` 按 `username` 模糊匹配（icontains）。\n"
        "- 不提供 DELETE：请使用 PATCH 将 `is_active` 设为 false 停用账号。\n"
        "- 重置密码或停用账号会撤销目标用户的全部历史 Token，重新启用不会恢复旧 Token。"
    ),
)
class AdminUserViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = AdminPagination
    queryset = (
        User.objects.select_related("role", "club_profile")
        .annotate(
            goods_count=Count("goods", distinct=True),
            theme_count=Count("themes", distinct=True),
        )
        .order_by("id")
    )
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AdminUserFilter
    search_fields = ["username"]
    ordering_fields = ["id", "username", "created_at", "updated_at"]
    ordering = ["id"]

    def get_serializer_class(self):
        if self.action == "create":
            return AdminUserCreateSerializer
        if self.action in ("update", "partial_update"):
            return AdminUserUpdateSerializer
        return AdminUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        record_admin_action(
            request,
            action="user.create",
            resource_type="user",
            resource_id=user.pk,
            summary=f"创建用户 {user.username}",
            changes={"username": user.username, "role_id": user.role_id},
        )
        out = AdminUserSerializer(user, context=self.get_serializer_context())
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        with transaction.atomic():
            instance = User.objects.select_for_update().select_related("role").get(
                pk=self.get_object().pk
            )
            list(
                User.objects.select_for_update()
                .filter(role__name__iexact="Admin", is_active=True)
                .order_by("id")
                .values_list("id", flat=True)
            )
            requested_role_id = request.data.get("role_id")
            disabling = request.data.get("is_active") is False
            demoting_admin = (
                instance.role.name.lower() == "admin"
                and requested_role_id is not None
                and str(requested_role_id) != str(instance.role_id)
            )
            if instance.pk == request.user.pk and (disabling or demoting_admin):
                return Response(
                    {"detail": "不能停用或降权当前登录管理员"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if (
                instance.role.name.lower() == "admin"
                and instance.is_active
                and (disabling or demoting_admin)
            ):
                remaining = User.objects.filter(
                    role__name__iexact="Admin",
                    is_active=True,
                ).exclude(pk=instance.pk).count()
                if remaining == 0:
                    return Response(
                        {"detail": "至少需要保留一个启用的管理员账号"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            before = snapshot_instance(instance, ("role_id", "is_active"))
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            user = User.objects.select_related("role").get(pk=instance.pk)
            record_admin_action(
                request,
                action="user.update",
                resource_type="user",
                resource_id=user.pk,
                summary=f"更新用户 {user.username}",
                changes={
                    "before": before,
                    "after": snapshot_instance(user, ("role_id", "is_active")),
                    "password_changed": bool(request.data.get("password")),
                },
            )
        return Response(
            AdminUserSerializer(user, context=self.get_serializer_context()).data
        )

    def _assert_admin_can_be_disabled(self, ids: list[int]) -> None:
        if self.request.user.pk in ids:
            raise serializers.ValidationError("不能停用当前登录管理员")
        disabled_admin_ids = set(
            User.objects.filter(
                id__in=ids,
                role__name__iexact="Admin",
                is_active=True,
            ).values_list("id", flat=True)
        )
        if not disabled_admin_ids:
            return
        remaining_active_admins = User.objects.filter(
            role__name__iexact="Admin",
            is_active=True,
        ).exclude(id__in=disabled_admin_ids).count()
        if remaining_active_admins == 0:
            raise serializers.ValidationError("至少需要保留一个启用的管理员账号")

    @action(detail=False, methods=["post"], url_path="bulk-action")
    def bulk_action(self, request):
        serializer = AdminBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        try:
            ids = [int(value) for value in payload["ids"]]
        except (TypeError, ValueError):
            return Response(
                {"detail": "用户 ID 必须是整数"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        action_name = payload["action"]
        allowed = {"enable", "disable", "approve"}
        if action_name not in allowed:
            return Response(
                {"detail": f"不支持的用户批量动作：{action_name}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = User.objects.select_related("role", "club_profile").filter(id__in=ids)
        found_ids = set(queryset.values_list("id", flat=True))
        missing = sorted(set(ids) - found_ids)
        if missing:
            return Response(
                {"detail": "部分用户不存在", "missing_ids": missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            list(
                User.objects.select_for_update()
                .filter(role__name__iexact="Admin", is_active=True)
                .order_by("id")
                .values_list("id", flat=True)
            )
            if action_name == "disable":
                self._assert_admin_can_be_disabled(ids)
            locked = list(queryset.select_for_update())
            if action_name == "approve":
                invalid = [
                    user.username
                    for user in locked
                    if user.account_type != User.ACCOUNT_TYPE_CLUB
                    or user.approval_status != User.APPROVAL_PENDING
                ]
                if invalid:
                    return Response(
                        {
                            "detail": "仅审批中的社团账号可以批量批准",
                            "invalid_usernames": invalid,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                for user in locked:
                    user.approval_status = User.APPROVAL_APPROVED
                    user.is_active = True
                    user.save(
                        update_fields=[
                            "approval_status",
                            "is_active",
                            "updated_at",
                        ]
                    )
            elif action_name == "enable":
                pending = [
                    user.username
                    for user in locked
                    if user.account_type == User.ACCOUNT_TYPE_CLUB
                    and user.approval_status == User.APPROVAL_PENDING
                ]
                if pending:
                    return Response(
                        {
                            "detail": "待审批社团请使用批准动作",
                            "invalid_usernames": pending,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                for user in locked:
                    user.is_active = True
                    user.save(update_fields=["is_active", "updated_at"])
            else:
                disabled_ids = []
                for user in locked:
                    user.is_active = False
                    user.save(update_fields=["is_active", "updated_at"])
                    disabled_ids.append(user.pk)
                User.revoke_tokens_by_ids(disabled_ids)

            record_admin_action(
                request,
                action=f"user.bulk_{action_name}",
                resource_type="user",
                resource_id=None,
                summary=f"批量{action_name}用户 {len(ids)} 个",
                changes={"ids": ids, "action": action_name},
            )
        return Response({"updated": len(ids), "action": action_name, "ids": ids})

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        user = self.get_object()
        if user.account_type != User.ACCOUNT_TYPE_CLUB or user.approval_status != User.APPROVAL_PENDING:
            return Response({"detail": "仅审批中的社团账号可以批准"}, status=status.HTTP_400_BAD_REQUEST)
        user.approval_status = User.APPROVAL_APPROVED
        user.is_active = True
        user.save(update_fields=["approval_status", "is_active", "updated_at"])
        record_admin_action(
            request,
            action="user.approve",
            resource_type="user",
            resource_id=user.pk,
            summary=f"批准社团账号 {user.username}",
            changes={"approval_status": User.APPROVAL_APPROVED},
        )
        return Response(AdminUserSerializer(user, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        user = self.get_object()
        if user.account_type != User.ACCOUNT_TYPE_CLUB or user.approval_status != User.APPROVAL_PENDING:
            return Response({"detail": "仅审批中的社团账号可以拒绝"}, status=status.HTTP_400_BAD_REQUEST)
        record_admin_action(
            request,
            action="user.reject",
            resource_type="user",
            resource_id=user.pk,
            summary=f"拒绝并删除社团申请 {user.username}",
            changes={"username": user.username},
        )
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    list=extend_schema(
        responses={200: OpenApiResponse(AdminRoleSerializer(many=True))},
    ),
)
@extend_schema(
    tags=["Admin"],
    summary="管理员：账号角色枚举",
    description="返回 `users.Role` 表记录，供后台分配用户角色时下拉使用（如 Admin、User）。",
)
class AdminRoleViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminRoleSerializer
    queryset = Role.objects.order_by("id")


@extend_schema(
    tags=["Admin"],
    summary="管理员：谷子工艺字典管理",
    description="维护前台谷子表单备注中“工艺”行的快捷填入选项。",
)
class AdminGoodsCraftViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminGoodsCraftSerializer
    pagination_class = AdminPagination
    queryset = GoodsCraft.objects.order_by("order", "id")
    search_fields = ["name"]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AdminGoodsCraftFilter
    ordering_fields = ["id", "name", "order", "created_at", "updated_at"]
    ordering = ["order", "id"]

    def perform_create(self, serializer):
        instance = serializer.save()
        record_admin_action(
            self.request,
            action="goods_craft.create",
            resource_type="goods_craft",
            resource_id=instance.pk,
            summary=f"创建谷子工艺 {instance.name}",
            changes=snapshot_instance(instance, ("name", "order", "is_active")),
        )

    def perform_update(self, serializer):
        before = snapshot_instance(
            serializer.instance,
            ("name", "order", "is_active"),
        )
        instance = serializer.save()
        record_admin_action(
            self.request,
            action="goods_craft.update",
            resource_type="goods_craft",
            resource_id=instance.pk,
            summary=f"更新谷子工艺 {instance.name}",
            changes={
                "before": before,
                "after": snapshot_instance(
                    instance,
                    ("name", "order", "is_active"),
                ),
            },
        )

    def perform_destroy(self, instance):
        payload = snapshot_instance(instance, ("id", "name", "order", "is_active"))
        instance.delete()
        record_admin_action(
            self.request,
            action="goods_craft.delete",
            resource_type="goods_craft",
            resource_id=payload.get("id"),
            summary=f"删除谷子工艺 {payload.get('name', '')}",
            changes=payload,
        )

    @action(detail=False, methods=["post"], url_path="bulk-action")
    def bulk_action(self, request):
        serializer = AdminBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            ids = [int(value) for value in serializer.validated_data["ids"]]
        except (TypeError, ValueError):
            return Response(
                {"detail": "工艺 ID 必须是整数"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        action_name = serializer.validated_data["action"]
        if action_name not in {"enable", "disable"}:
            return Response(
                {"detail": f"不支持的工艺批量动作：{action_name}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            queryset = GoodsCraft.objects.select_for_update().filter(id__in=ids)
            found_ids = set(queryset.values_list("id", flat=True))
            missing = sorted(set(ids) - found_ids)
            if missing:
                return Response(
                    {"detail": "部分工艺不存在", "missing_ids": missing},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset.update(
                is_active=action_name == "enable",
                updated_at=timezone.now(),
            )
            record_admin_action(
                request,
                action=f"goods_craft.bulk_{action_name}",
                resource_type="goods_craft",
                resource_id=None,
                summary=f"批量{action_name}谷子工艺 {len(ids)} 个",
                changes={"ids": ids, "action": action_name},
            )
        return Response({"updated": len(ids), "action": action_name, "ids": ids})


# ==================== 全站数据管理列表 ====================


class AdminGoodsViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = AdminPagination
    serializer_class = AdminGoodsListSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AdminGoodsFilter
    search_fields = (
        "name",
        "ip__name",
        "ip__keywords__value",
        "characters__name",
        "user__username",
    )
    ordering_fields = [
        "id",
        "name",
        "price",
        "quantity",
        "status",
        "purchase_date",
        "created_at",
        "updated_at",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            Goods.objects.select_related(
                "user",
                "ip",
                "category",
                "theme",
                "location",
            )
            .prefetch_related("characters__ip", "additional_photos")
            .distinct()
        )

    @action(detail=False, methods=["post"], url_path="bulk-action")
    def bulk_action(self, request):
        serializer = AdminBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        ids = payload["ids"]
        action_name = payload["action"]
        if action_name not in {"status", "category", "theme"}:
            return Response(
                {"detail": f"不支持的谷子批量动作：{action_name}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        updates: dict[str, object] = {}
        if action_name == "status":
            valid_statuses = {choice[0] for choice in Goods.STATUS_CHOICES}
            if payload.get("status") not in valid_statuses:
                return Response(
                    {"detail": "无效的谷子状态"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["status"] = payload["status"]
        elif action_name == "category":
            category_id = payload.get("category_id")
            if category_id is None or not Category.objects.filter(pk=category_id).exists():
                return Response(
                    {"detail": "目标品类不存在"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["category_id"] = category_id
        else:
            theme_id = payload.get("theme_id")
            if theme_id is not None and not Theme.objects.filter(pk=theme_id).exists():
                return Response(
                    {"detail": "目标主题不存在"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updates["theme_id"] = theme_id

        with transaction.atomic():
            locked_goods = list(Goods.objects.select_for_update().filter(id__in=ids))
            found_ids = {str(item.id) for item in locked_goods}
            missing = sorted(set(str(value) for value in ids) - found_ids)
            if missing:
                return Response(
                    {"detail": "部分谷子不存在", "missing_ids": missing},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            for goods in locked_goods:
                for field, value in updates.items():
                    setattr(goods, field, value)
                goods.save(update_fields=[*updates.keys(), "updated_at"])
            record_admin_action(
                request,
                action=f"goods.bulk_{action_name}",
                resource_type="goods",
                resource_id=None,
                summary=f"批量修改谷子 {len(ids)} 条",
                changes={"ids": ids, "action": action_name, "updates": updates},
            )
        return Response({"updated": len(ids), "action": action_name, "ids": ids})


class AdminIPViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = AdminPagination
    serializer_class = AdminIPListSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AdminIPFilter
    search_fields = ("name", "keywords__value")
    ordering_fields = [
        "id",
        "name",
        "subject_type",
        "order",
        "character_count",
        "goods_count",
        "created_at",
        "last_synced_at",
    ]
    ordering = ["order", "id"]

    def get_queryset(self):
        return (
            IP.objects.prefetch_related("keywords")
            .annotate(
                character_count=Count("characters", distinct=True),
                goods_count=Count("goods", distinct=True),
            )
            .distinct()
        )


class AdminCharacterViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = AdminPagination
    serializer_class = AdminCharacterListSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AdminCharacterFilter
    search_fields = ("name", "ip__name", "ip__keywords__value")
    ordering_fields = ["id", "name", "ip__name", "created_at"]
    ordering = ["created_at", "id"]

    def get_queryset(self):
        return Character.objects.select_related("ip").annotate(
            goods_count=Count("goods", distinct=True)
        )


class AdminThemeViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = AdminPagination
    serializer_class = AdminThemeListSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AdminThemeFilter
    search_fields = ("name", "description", "user__username")
    ordering_fields = [
        "id",
        "name",
        "goods_count",
        "image_count",
        "created_at",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            Theme.objects.select_related("user")
            .annotate(
                goods_count=Count("goods", distinct=True),
                image_count=Count("images", distinct=True),
            )
            .distinct()
        )


class AdminCategoryListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = None
    serializer_class = AdminCategoryListSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AdminCategoryFilter
    search_fields = ("name", "path_name")
    ordering_fields = ["id", "name", "order", "created_at"]
    ordering = ["order", "id"]

    def get_queryset(self):
        return Category.objects.select_related("parent")

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        categories = list(queryset)
        direct_counts = {
            row["category_id"]: int(row["quantity_sum"] or 0)
            for row in Goods.objects.exclude(status="draft")
            .values("category_id")
            .annotate(quantity_sum=Sum("quantity"))
        }
        all_categories = list(Category.objects.only("id", "parent_id"))
        children_by_parent: dict[int | None, list[Category]] = {}
        for category in all_categories:
            children_by_parent.setdefault(category.parent_id, []).append(category)

        memo: dict[int, int] = {}

        def subtree_count(category: Category) -> int:
            if category.pk in memo:
                return memo[category.pk]
            total = direct_counts.get(category.pk, 0)
            for child in children_by_parent.get(category.pk, []):
                total += subtree_count(child)
            memo[category.pk] = total
            return total

        for category in categories:
            category.goods_count = subtree_count(category)
        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)


# ==================== 管理员总览与审计 ====================


def _daily_trend(queryset, date_field: str, start_date, days: int):
    rows = (
        queryset.filter(**{f"{date_field}__date__gte": start_date})
        .annotate(day=TruncDate(date_field, tzinfo=ZoneInfo("Asia/Shanghai")))
        .values("day")
        .annotate(value=Count("id"))
        .order_by("day")
    )
    by_day = {row["day"]: row["value"] for row in rows}
    return [
        {
            "date": (start_date + timedelta(days=offset)).isoformat(),
            "value": by_day.get(start_date + timedelta(days=offset), 0),
        }
        for offset in range(days + 1)
    ]


class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        range_key = request.query_params.get("range", "30d")
        if range_key not in {"7d", "30d"}:
            return Response(
                {"detail": "range 仅支持 7d 或 30d"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        days = 7 if range_key == "7d" else 30
        cache_key = f"admin-overview:{range_key}"
        payload = cache.get(cache_key)
        if payload is None:
            now = timezone.now()
            start_at = now - timedelta(days=days)
            start_date = timezone.localdate(
                timezone.localtime(start_at, ZoneInfo("Asia/Shanghai"))
            )

            value_expr = ExpressionWrapper(
                Cast(
                    F("quantity"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                )
                * Coalesce(
                    F("price"),
                    Value(
                        Decimal("0"),
                        output_field=DecimalField(max_digits=10, decimal_places=2),
                    ),
                    output_field=DecimalField(max_digits=10, decimal_places=2),
                ),
                output_field=DecimalField(max_digits=20, decimal_places=2),
            )
            goods_stats = Goods.objects.aggregate(
                total=Count("id"),
                quantity_sum=Coalesce(Sum("quantity"), Value(0)),
                value=Coalesce(
                    Sum(value_expr),
                    Value(
                        Decimal("0"),
                        output_field=DecimalField(max_digits=20, decimal_places=2),
                    ),
                ),
                missing_photo=Count(
                    "id",
                    filter=Q(main_photo="") | Q(main_photo__isnull=True),
                ),
            )
            user_total = User.objects.count()
            pending_clubs = User.objects.filter(
                account_type=User.ACCOUNT_TYPE_CLUB,
                approval_status=User.APPROVAL_PENDING,
            ).count()
            running_jobs = BGMSyncJob.objects.filter(status="running").count()
            failed_jobs = BGMSyncJob.objects.filter(
                status__in=("failed", "partial"),
                started_at__gte=start_at,
            ).count()

            from apps.gamification.models import (
                Achievement,
                AchievementSet,
                MetricSyncFailure,
                Reward,
            )

            sync_failures = MetricSyncFailure.objects.filter(
                resolved_at__isnull=True
            ).count()
            audit_retries = AdminAuditRetry.objects.filter(
                resolved_at__isnull=True
            ).count()
            gamification_stats = {
                "active_sets": AchievementSet.objects.filter(
                    club__isnull=True,
                    is_active=True,
                ).count(),
                "active_achievements": Achievement.objects.filter(
                    set__club__isnull=True,
                    is_active=True,
                ).count(),
                "active_rewards": Reward.objects.filter(
                    club__isnull=True,
                    is_active=True,
                ).count(),
                "sync_failures": sync_failures,
            }

            recent_jobs = BGMSyncJob.objects.select_related("triggered_by").order_by(
                "-started_at"
            )[:5]
            recent_audits = AdminAuditLog.objects.select_related("actor").order_by(
                "-created_at",
                "-id",
            )[:8]

            alerts = []
            if pending_clubs:
                alerts.append(
                    {
                        "code": "pending_clubs",
                        "severity": "warning",
                        "title": "待审批社团",
                        "count": pending_clubs,
                        "href": "/admin/users?approval_status=pending&account_type=club",
                    }
                )
            if goods_stats["missing_photo"]:
                alerts.append(
                    {
                        "code": "missing_goods_photo",
                        "severity": "info",
                        "title": "谷子缺少主图",
                        "count": goods_stats["missing_photo"],
                        "href": "/admin/goods?has_main_photo=false",
                    }
                )
            if failed_jobs:
                alerts.append(
                    {
                        "code": "bgm_recent_failure",
                        "severity": "danger",
                        "title": "近期 BGM 同步异常",
                        "count": failed_jobs,
                        "href": "/admin/bgm-sync?status=failed",
                    }
                )
            if sync_failures:
                alerts.append(
                    {
                        "code": "gamification_sync_failure",
                        "severity": "danger",
                        "title": "游戏化指标待重试",
                        "count": sync_failures,
                        "href": "/admin/gamification",
                    }
                )
            if running_jobs:
                alerts.append(
                    {
                        "code": "bgm_running",
                        "severity": "info",
                        "title": "BGM 同步执行中",
                        "count": running_jobs,
                        "href": "/admin/bgm-sync",
                    }
                )
            if audit_retries:
                alerts.append(
                    {
                        "code": "admin_audit_retry",
                        "severity": "warning",
                        "title": "管理员审计待补偿",
                        "count": audit_retries,
                        "href": "/admin/audit-logs",
                    }
                )

            payload = {
                "generated_at": now,
                "range": range_key,
                "stats": {
                    "users": {
                        "total": user_total,
                        "new_in_range": User.objects.filter(
                            created_at__gte=start_at
                        ).count(),
                        "active": User.objects.filter(is_active=True).count(),
                        "pending_clubs": pending_clubs,
                    },
                    "goods": {
                        "total": goods_stats["total"],
                        "new_in_range": Goods.objects.filter(
                            created_at__gte=start_at
                        ).count(),
                        "quantity": int(goods_stats["quantity_sum"] or 0),
                        "value": str(goods_stats["value"] or 0),
                        "missing_photo": goods_stats["missing_photo"],
                    },
                    "catalog": {
                        "ips": IP.objects.count(),
                        "characters": Character.objects.count(),
                        "categories": Category.objects.count(),
                        "themes": Theme.objects.count(),
                    },
                    "gamification": gamification_stats,
                    "bgm": {
                        "running": running_jobs,
                        "recent_failures": failed_jobs,
                    },
                },
                "alerts": alerts,
                "trends": {
                    "users": _daily_trend(User.objects.all(), "created_at", start_date, days),
                    "goods": _daily_trend(Goods.objects.all(), "created_at", start_date, days),
                },
                "recent_jobs": BGMSyncJobListSerializer(
                    recent_jobs,
                    many=True,
                ).data,
                "recent_audits": AdminAuditLogSerializer(
                    recent_audits,
                    many=True,
                ).data,
            }
            cache.set(cache_key, payload, timeout=60)
        return Response(payload)


class AdminAuditLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = AdminPagination
    serializer_class = AdminAuditLogSerializer
    queryset = AdminAuditLog.objects.select_related("actor").order_by(
        "-created_at",
        "-id",
    )
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = AdminAuditLogFilter
    search_fields = ("summary", "resource_id", "actor__username")
    ordering_fields = ["id", "created_at", "action", "resource_type"]
    ordering = ["-created_at", "-id"]


# ==================== BGM 自动同步管理 ====================


@extend_schema(
    tags=["Admin", "BGM Sync"],
    summary="管理员：BGM 自动同步配置",
    description="读取或更新全局 BGM 自动同步配置（单例）。",
)
class BGMSyncSettingsView(APIView):
    """单例配置：GET / PATCH /api/admin/bgm-sync/settings/。

    使用 APIView 而非 ModelViewSet，避免 DefaultRouter 强制 pk 占位。
    """

    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = BGMSyncSettingsSerializer

    def get(self, request, *args, **kwargs):
        instance = BGMSyncSettings.get_solo()
        serializer = self.serializer_class(instance)
        return Response(serializer.data)

    def patch(self, request, *args, **kwargs):
        instance = BGMSyncSettings.get_solo()
        before = snapshot_instance(
            instance,
            ("auto_sync_enabled", "frequency", "request_interval_ms"),
        )
        serializer = self.serializer_class(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        record_admin_action(
            request,
            action="bgm_settings.update",
            resource_type="bgm_settings",
            resource_id=instance.pk,
            summary="更新 BGM 自动同步配置",
            changes={
                "before": before,
                "after": snapshot_instance(
                    instance,
                    ("auto_sync_enabled", "frequency", "request_interval_ms"),
                ),
            },
        )
        return Response(serializer.data)

    # 兼容 PUT 全量更新（前端可不用）
    def put(self, request, *args, **kwargs):
        instance = BGMSyncSettings.get_solo()
        before = snapshot_instance(
            instance,
            ("auto_sync_enabled", "frequency", "request_interval_ms"),
        )
        serializer = self.serializer_class(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        record_admin_action(
            request,
            action="bgm_settings.replace",
            resource_type="bgm_settings",
            resource_id=instance.pk,
            summary="替换 BGM 自动同步配置",
            changes={
                "before": before,
                "after": snapshot_instance(
                    instance,
                    ("auto_sync_enabled", "frequency", "request_interval_ms"),
                ),
            },
        )
        return Response(serializer.data)


@extend_schema(
    tags=["Admin", "BGM Sync"],
    summary="管理员：立即执行一次 BGM 同步",
    description=(
        "在后台线程执行同步，HTTP 立即返回 job 摘要。"
        "若已有同步任务在跑则返回 409。"
    ),
    request=None,
    responses={200: BGMSyncJobDetailSerializer},
)
@api_view(["POST"])
@permission_classes_decorator([IsAuthenticated, IsAdmin])
def bgm_sync_run_now(request):
    """POST /api/admin/bgm-sync/run-now/"""
    from apps.goods.bgm_auto_sync import start_manual_sync

    try:
        job = start_manual_sync(triggered_by=request.user)
    except RuntimeError as e:
        return Response(
            {"detail": str(e)}, status=status.HTTP_409_CONFLICT
        )
    record_admin_action(
        request,
        action="bgm_sync.run_now",
        resource_type="bgm_sync_job",
        resource_id=job.pk,
        summary=f"手动触发 BGM 同步任务 #{job.pk}",
        changes={"job_id": job.pk},
    )
    return Response(
        BGMSyncJobDetailSerializer(job).data, status=status.HTTP_200_OK
    )


@extend_schema(
    tags=["Admin", "BGM Sync"],
    summary="管理员：BGM 同步任务历史",
    description="分页查看自动/手动同步任务历史，支持按状态、触发方式、时间范围筛选。",
)
class BGMSyncJobViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = AdminPagination
    serializer_class = BGMSyncJobListSerializer
    queryset = BGMSyncJob.objects.select_related("triggered_by").order_by("-started_at")
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = {
        "status": ["exact", "in"],
        "trigger": ["exact", "in"],
        "started_at": ["gte", "lte"],
    }
    ordering_fields = ["id", "started_at", "finished_at", "status"]
    ordering = ["-started_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return BGMSyncJobDetailSerializer
        return BGMSyncJobListSerializer

    @action(detail=True, methods=["get"], url_path="items")
    def items(self, request, pk=None):
        """获取某次任务的 IP 明细列表（分页 + 筛选）。

        查询参数：
        - ``status``：明细状态过滤（success / no_change / skipped_unbound / error）
        - ``ip_name_snapshot``：IP 名称模糊匹配（icontains）
        """
        job = self.get_object()
        items_qs = job.items.all()
        status_filter = request.query_params.get("status")
        if status_filter:
            items_qs = items_qs.filter(status=status_filter)
        ip_name = request.query_params.get("ip_name_snapshot")
        if ip_name:
            items_qs = items_qs.filter(ip_name_snapshot__icontains=ip_name)

        paginator = AdminPagination()
        page = paginator.paginate_queryset(items_qs, request)
        serializer = BGMSyncJobItemSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
