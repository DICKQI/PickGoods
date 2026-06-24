from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
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

from apps.goods.models import BGMSyncJob, BGMSyncJobItem, BGMSyncSettings, IP
from apps.users.models import Role, User
from core.permissions import IsAdmin

from .serializers import (
    AdminRoleSerializer,
    AdminUserCreateSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    BGMSyncJobDetailSerializer,
    BGMSyncJobItemSerializer,
    BGMSyncJobListSerializer,
    BGMSyncSettingsSerializer,
)


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
        "- 不提供 DELETE：请使用 PATCH 将 `is_active` 设为 false 停用账号。"
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
    queryset = User.objects.select_related("role").order_by("id")
    # 复用全局 SearchFilter（见 settings.DEFAULT_FILTER_BACKENDS），
    # 查询参数名为 search，对 username 做 icontains 模糊匹配。
    search_fields = ["username"]

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
        out = AdminUserSerializer(user, context=self.get_serializer_context())
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        user = User.objects.select_related("role").get(pk=instance.pk)
        return Response(
            AdminUserSerializer(user, context=self.get_serializer_context()).data
        )


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
        serializer = self.serializer_class(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        return Response(serializer.data)

    # 兼容 PUT 全量更新（前端可不用）
    def put(self, request, *args, **kwargs):
        instance = BGMSyncSettings.get_solo()
        serializer = self.serializer_class(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
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
    filterset_fields = {
        "status": ["exact", "in"],
        "trigger": ["exact", "in"],
        "started_at": ["date__gte", "date__lte"],
    }

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
