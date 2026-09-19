from __future__ import annotations

import csv
from datetime import datetime
from typing import Any, Callable

from django.db.models import Count
from django.http import JsonResponse, StreamingHttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.goods.models import (
    BGMSyncJob,
    Category,
    Character,
    Goods,
    GoodsCraft,
    IP,
    Theme,
)
from apps.users.models import User
from core.permissions import IsAdmin

from .filters import (
    AdminCategoryFilter,
    AdminCharacterFilter,
    AdminGoodsFilter,
    AdminGoodsCraftFilter,
    AdminIPFilter,
    AdminThemeFilter,
    AdminUserFilter,
)
from .models import AdminAuditLog
from .services import record_admin_action, sanitize_audit_value


EXPORT_MAX_ROWS = 100_000


class EchoBuffer:
    def write(self, value: str) -> str:
        return value


def csv_safe(value: Any) -> Any:
    value = sanitize_audit_value(value)
    if isinstance(value, str) and value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{value}"
    return value


def _status_label(value: str) -> str:
    return {
        "draft": "草稿",
        "intended": "意向入手",
        "in_cabinet": "在馆",
        "outdoor": "出街中",
        "sold": "已售出",
    }.get(value, value)


def _export_users(request):
    filterset = AdminUserFilter(request.GET, queryset=User.objects.select_related("role", "club_profile"))
    qs = filterset.qs
    qs = SearchFilter().filter_queryset(request, qs, _ExportFilterView(["username"]))
    qs = OrderingFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView([], ["id", "username", "created_at", "updated_at"]),
    )
    return qs, (
        "ID",
        "用户名",
        "账号角色",
        "账号类型",
        "审批状态",
        "启用状态",
        "社团名称",
        "申请理由",
        "创建时间",
        "更新时间",
    ), lambda obj: (
        obj.id,
        obj.username,
        obj.role.name,
        obj.account_type,
        obj.approval_status,
        "启用" if obj.is_active else "停用",
        getattr(getattr(obj, "club_profile", None), "name", ""),
        getattr(getattr(obj, "club_profile", None), "application_reason", ""),
        obj.created_at,
        obj.updated_at,
    )


def _export_goods(request):
    qs = Goods.objects.select_related("user", "ip", "category", "theme").prefetch_related(
        "characters"
    )
    qs = AdminGoodsFilter(request.GET, queryset=qs).qs
    search_fields = ("name", "ip__name", "characters__name", "user__username")
    qs = SearchFilter().filter_queryset(request, qs, _ExportFilterView(search_fields))
    qs = OrderingFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView(
            [],
            [
                "id",
                "name",
                "price",
                "quantity",
                "status",
                "purchase_date",
                "created_at",
                "updated_at",
            ],
        ),
    )
    return qs.distinct(), (
        "资产ID",
        "谷子名称",
        "归属用户",
        "IP",
        "角色",
        "品类",
        "主题",
        "状态",
        "数量",
        "单价",
        "官谷",
        "入手日期",
        "创建时间",
        "更新时间",
    ), lambda obj: (
        obj.id,
        obj.name,
        obj.user.username,
        obj.ip.name if obj.ip_id else "",
        "、".join(character.name for character in obj.characters.all()),
        obj.category.name if obj.category_id else "",
        obj.theme.name if obj.theme_id else "",
        _status_label(obj.status),
        obj.quantity,
        obj.price,
        "是" if obj.is_official else "否",
        obj.purchase_date,
        obj.created_at,
        obj.updated_at,
    )


def _export_ips(request):
    qs = IP.objects.prefetch_related("keywords").annotate(
        character_count=Count("characters", distinct=True),
        goods_count=Count("goods", distinct=True),
    )
    qs = AdminIPFilter(request.GET, queryset=qs).qs
    qs = SearchFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView(("name", "keywords__value")),
    )
    qs = OrderingFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView([], ["id", "name", "order", "created_at", "last_synced_at"]),
    )
    return qs.distinct(), (
        "ID",
        "IP 名称",
        "作品类型",
        "关键词",
        "角色数",
        "谷子数",
        "排序",
        "BGM ID",
        "最近同步",
        "创建时间",
    ), lambda obj: (
        obj.id,
        obj.name,
        obj.get_subject_type_display() if obj.subject_type else "",
        "、".join(keyword.value for keyword in obj.keywords.all()),
        obj.character_count,
        obj.goods_count,
        obj.order,
        obj.bgm_subject_id,
        obj.last_synced_at,
        obj.created_at,
    )


def _export_characters(request):
    qs = Character.objects.select_related("ip")
    qs = AdminCharacterFilter(request.GET, queryset=qs).qs
    qs = SearchFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView(("name", "ip__name", "ip__keywords__value")),
    )
    qs = OrderingFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView([], ["id", "name", "ip__name", "created_at"]),
    )
    return qs, (
        "ID",
        "角色名",
        "IP",
        "性别",
        "头像",
        "BGM 角色 ID",
        "创建时间",
    ), lambda obj: (
        obj.id,
        obj.name,
        obj.ip.name,
        obj.get_gender_display(),
        obj.avatar,
        obj.bgm_character_id,
        obj.created_at,
    )


def _export_themes(request):
    qs = Theme.objects.select_related("user").annotate(
        goods_count=Count("goods", distinct=True),
        image_count=Count("images", distinct=True),
    )
    qs = AdminThemeFilter(request.GET, queryset=qs).qs
    qs = SearchFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView(("name", "description", "user__username")),
    )
    qs = OrderingFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView([], ["id", "name", "goods_count", "image_count", "created_at"]),
    )
    return qs.distinct(), (
        "ID",
        "主题名称",
        "描述",
        "归属用户",
        "谷子数",
        "图片数",
        "创建时间",
    ), lambda obj: (
        obj.id,
        obj.name,
        obj.description,
        obj.user.username,
        obj.goods_count,
        obj.image_count,
        obj.created_at,
    )


def _export_categories(request):
    qs = Category.objects.select_related("parent").annotate(
        goods_count=Count("goods", distinct=True)
    )
    qs = AdminCategoryFilter(request.GET, queryset=qs).qs
    qs = SearchFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView(("name", "path_name")),
    )
    qs = OrderingFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView([], ["id", "name", "order", "created_at"]),
    )
    return qs, (
        "ID",
        "品类名称",
        "完整路径",
        "父级",
        "形状",
        "颜色",
        "排序",
        "直接谷子数",
        "创建时间",
    ), lambda obj: (
        obj.id,
        obj.name,
        obj.path_name,
        obj.parent.name if obj.parent_id else "",
        obj.get_shape_type_display() if obj.shape_type else "",
        obj.color_tag,
        obj.order,
        obj.goods_count,
        obj.created_at,
    )


def _export_goods_crafts(request):
    qs = GoodsCraft.objects.all()
    qs = AdminGoodsCraftFilter(request.GET, queryset=qs).qs
    qs = SearchFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView(("name",)),
    )
    qs = OrderingFilter().filter_queryset(
        request,
        qs,
        _ExportFilterView([], ["id", "name", "order", "created_at", "updated_at"]),
    )
    return qs, (
        "ID",
        "工艺名称",
        "排序",
        "启用状态",
        "创建时间",
        "更新时间",
    ), lambda obj: (
        obj.id,
        obj.name,
        obj.order,
        "启用" if obj.is_active else "停用",
        obj.created_at,
        obj.updated_at,
    )


def _export_bgm_jobs(request):
    qs = BGMSyncJob.objects.select_related("triggered_by")
    status_filter = request.query_params.get("status")
    trigger_filter = request.query_params.get("trigger")
    if status_filter:
        qs = qs.filter(status=status_filter)
    if trigger_filter:
        qs = qs.filter(trigger=trigger_filter)
    started_after = request.query_params.get("started_at__gte")
    started_before = request.query_params.get("started_at__lte")
    if started_after:
        qs = qs.filter(started_at__gte=started_after)
    if started_before:
        qs = qs.filter(started_at__lte=started_before)
    return qs, (
        "任务 ID",
        "触发方式",
        "状态",
        "开始时间",
        "结束时间",
        "触发人",
        "IP 总数",
        "成功",
        "失败",
        "跳过",
        "新增角色",
        "回填角色",
        "错误信息",
    ), lambda obj: (
        obj.id,
        obj.get_trigger_display(),
        obj.get_status_display(),
        obj.started_at,
        obj.finished_at,
        obj.triggered_by.username if obj.triggered_by_id else "",
        obj.total_ips,
        obj.success_count,
        obj.failed_count,
        obj.skipped_count,
        obj.created_total,
        obj.linked_total,
        obj.error_message,
    )


def _export_audit_logs(request):
    from .filters import AdminAuditLogFilter

    qs = AdminAuditLog.objects.select_related("actor")
    qs = AdminAuditLogFilter(request.GET, queryset=qs).qs
    return qs, (
        "ID",
        "操作管理员",
        "动作",
        "资源类型",
        "资源 ID",
        "摘要",
        "来源 IP",
        "操作时间",
    ), lambda obj: (
        obj.id,
        obj.actor.username if obj.actor_id else "",
        obj.action,
        obj.resource_type,
        obj.resource_id,
        obj.summary,
        obj.ip_address,
        obj.created_at,
    )


class _ExportFilterView:
    def __init__(self, search_fields=(), ordering_fields=()):
        self.search_fields = search_fields
        self.ordering_fields = ordering_fields


RESOURCE_EXPORTERS: dict[str, Callable[[Any], tuple[Any, tuple[str, ...], Callable[[Any], tuple[Any, ...]]]]] = {
    "users": _export_users,
    "goods": _export_goods,
    "ips": _export_ips,
    "characters": _export_characters,
    "themes": _export_themes,
    "categories": _export_categories,
    "goods-crafts": _export_goods_crafts,
    "bgm-jobs": _export_bgm_jobs,
    "audit-logs": _export_audit_logs,
}


class AdminExportView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, resource: str):
        exporter = RESOURCE_EXPORTERS.get(resource)
        if exporter is None:
            return JsonResponse(
                {"detail": "不支持的导出资源"},
                status=status.HTTP_404_NOT_FOUND,
            )

        queryset, headers, row_builder = exporter(request)
        row_count = queryset.count()
        if row_count > EXPORT_MAX_ROWS:
            return JsonResponse(
                {
                    "detail": (
                        f"导出结果超过 {EXPORT_MAX_ROWS} 行，请缩小筛选范围后重试"
                    ),
                    "count": row_count,
                    "max_rows": EXPORT_MAX_ROWS,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        record_admin_action(
            request,
            action="export.create",
            resource_type="export",
            resource_id=resource,
            summary=f"导出 {resource} CSV，共 {row_count} 行",
            changes={"filters": dict(request.query_params), "row_count": row_count},
        )

        buffer = EchoBuffer()
        writer = csv.writer(buffer)

        def rows():
            yield "\ufeff"
            yield writer.writerow(headers)
            for obj in queryset.iterator(chunk_size=2000):
                yield writer.writerow(
                    [csv_safe(value) for value in row_builder(obj)]
                )

        timestamp = timezone.localtime().strftime("%Y%m%d-%H%M%S")
        response = StreamingHttpResponse(rows(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = (
            f'attachment; filename="admin-{resource}-{timestamp}.csv"'
        )
        return response
