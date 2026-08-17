from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models, transaction
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsOwnerOnly, is_admin

from .models import Notification, Preorder
from .serializers import (
    ConvertPreorderToGoodsSerializer,
    DelayPreorderSerializer,
    NotificationSerializer,
    PreorderDelayRecordSerializer,
    PreorderSerializer,
    ReadNotificationsSerializer,
)
from .services import (
    delay_preorder,
    mark_preorder_notifications_read,
    mark_preorder_notifications_stale,
    notify_status_change,
    sync_due_notifications,
    sync_preorder,
)


class ReminderPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "page": self.page.number,
                "page_size": self.page.paginator.per_page,
                "next": self.page.next_page_number() if self.page.has_next() else None,
                "previous": self.page.previous_page_number() if self.page.has_previous() else None,
                "results": data,
            }
        )


class NotificationPagination(ReminderPagination):
    page_size = 20


class PreorderViewSet(viewsets.ModelViewSet):
    """手办预购登记 CRUD 与状态流转。

    - 状态机：pending → paid（mark-paid，不可逆）；pending → cancelled（cancel）；
      paid → converted（convert-to-goods，终态）；其余流转一律 400。
    - 创建后触发惰性通知同步；预计补款时间只能通过 delay action 顺延。
    """

    queryset = Preorder.objects.select_related("goods").all()
    serializer_class = PreorderSerializer
    permission_classes = [IsAuthenticated, IsOwnerOnly]
    pagination_class = ReminderPagination
    filter_backends = (DjangoFilterBackend, drf_filters.SearchFilter)
    filterset_fields = ("status",)
    search_fields = ("name",)

    def get_queryset(self):
        qs = Preorder.objects.select_related("goods")
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "id", None):
            return qs.none()
        if is_admin(user):
            return qs
        return qs.filter(user=user)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """预购统计概览（纯读，零副作用）。

        权限语义与列表一致：普通用户统计自己的预购，管理员统计全部。
        - due_this_month：按月粒度的预购中，预计补款月份为当月；
        - due_this_quarter：按季度粒度的预购中，预计补款季度为当季；
        - total_pending_balance：待补款预购的尾款总额（尾款未知按 0 计）。
        """
        qs = self.get_queryset()
        today = timezone.localdate()
        month_start = today.replace(day=1)
        quarter_start = month_start.replace(
            month=((today.month - 1) // 3) * 3 + 1
        )
        aggregated = qs.aggregate(
            pending_count=models.Count("id", filter=models.Q(status=Preorder.STATUS_PENDING)),
            due_this_month=models.Count(
                "id",
                filter=models.Q(
                    status=Preorder.STATUS_PENDING,
                    time_granularity=Preorder.GRANULARITY_MONTH,
                    estimated_month=month_start,
                ),
            ),
            due_this_quarter=models.Count(
                "id",
                filter=models.Q(
                    status=Preorder.STATUS_PENDING,
                    time_granularity=Preorder.GRANULARITY_QUARTER,
                    estimated_month=quarter_start,
                ),
            ),
            converted_count=models.Count(
                "id", filter=models.Q(status=Preorder.STATUS_CONVERTED)
            ),
            total_pending_balance=models.Sum(
                Coalesce(
                    "balance_amount",
                    0,
                    output_field=models.DecimalField(max_digits=10, decimal_places=2),
                ),
                filter=models.Q(status=Preorder.STATUS_PENDING),
            ),
        )
        return Response(
            {
                "pending_count": aggregated["pending_count"],
                "due_this_month": aggregated["due_this_month"],
                "due_this_quarter": aggregated["due_this_quarter"],
                "converted_count": aggregated["converted_count"],
                "total_pending_balance": (
                    f"{aggregated['total_pending_balance']:.2f}"
                    if aggregated["total_pending_balance"] is not None
                    else "0.00"
                ),
            }
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        # 登记时若已处于提醒窗口 / 补款期，立即生成通知
        sync_preorder(serializer.instance)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        preorder = self.get_object()
        if preorder.status != Preorder.STATUS_PENDING:
            return Response(
                {"detail": "仅待补款状态的预购可标记为已补款"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        preorder.status = Preorder.STATUS_PAID
        preorder.paid_at = timezone.now()
        preorder.save(update_fields=["status", "paid_at", "updated_at"])
        mark_preorder_notifications_read(preorder)
        return Response(PreorderSerializer(preorder).data)

    @action(detail=True, methods=["post"], url_path="delay")
    def delay(self, request, pk=None):
        """跳票延期：顺延预计补款时间并记录延期历史。

        仅 pending 可延期（含已过补款期仍未补款的）；目标时间必须严格晚于
        当前预计时间；粒度创建后保持不变。旧提醒置过期
        并按新时间重新生成，同时生成一条「已延期」通知。
        """
        preorder = self.get_object()
        serializer = DelayPreorderSerializer(
            data=request.data,
            context={"preorder": preorder},
        )
        serializer.is_valid(raise_exception=True)
        try:
            updated = delay_preorder(
                preorder,
                to_month=serializer.validated_data["to_month"],
                reason=serializer.validated_data["reason"],
                note=serializer.validated_data.get("note") or "",
            )
        except DjangoValidationError as exc:
            detail = {
                field: messages[0] if len(messages) == 1 else messages
                for field, messages in exc.message_dict.items()
            }
            return Response(detail, status=status.HTTP_400_BAD_REQUEST)
        return Response(PreorderSerializer(updated).data)

    @action(detail=True, methods=["get"], url_path="delays")
    def delays(self, request, pk=None):
        """预购延期历史（新→旧，不分页）。"""
        preorder = self.get_object()
        records = preorder.delay_records.all()
        return Response(PreorderDelayRecordSerializer(records, many=True).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        preorder = self.get_object()
        if preorder.status != Preorder.STATUS_PENDING:
            return Response(
                {"detail": "仅待补款状态的预购可取消"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        preorder.status = Preorder.STATUS_CANCELLED
        preorder.save(update_fields=["status", "updated_at"])
        # 旧提醒过期，并生成「已取消补款」通知
        mark_preorder_notifications_stale(preorder)
        notify_status_change(preorder, Notification.TYPE_CANCELLED)
        return Response(PreorderSerializer(preorder).data)

    @action(detail=True, methods=["post"], url_path="convert-to-goods")
    def convert_to_goods(self, request, pk=None):
        preorder = self.get_object()
        if preorder.goods_id is not None:
            return Response(
                {"detail": "该预购已转正为谷子，不能重复转正"},
                status=status.HTTP_409_CONFLICT,
            )
        if preorder.status != Preorder.STATUS_PAID:
            return Response(
                {"detail": "仅已补款状态的预购可转正为谷子"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ConvertPreorderToGoodsSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            goods = serializer.save(preorder=preorder, user=request.user)
            preorder.goods = goods
            preorder.status = Preorder.STATUS_CONVERTED
            preorder.save(update_fields=["goods", "status", "updated_at"])
        mark_preorder_notifications_read(preorder)
        notify_status_change(preorder, Notification.TYPE_CONVERTED)
        return Response(PreorderSerializer(preorder).data, status=status.HTTP_201_CREATED)


class NotificationViewSet(viewsets.GenericViewSet):
    """站内通知。

    - list / unread-count：列表本身零副作用；惰性同步只发生在 unread-count
      （前端 60s 轮询驱动，同步频率有界）。
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = NotificationPagination

    def get_queryset(self):
        return (
            Notification.objects.filter(user=self.request.user)
            .select_related("preorder")
            .order_by("-created_at", "-id")
        )

    def list(self, request):
        queryset = self.get_queryset()
        if request.query_params.get("unread_only") in ("1", "true", "True"):
            queryset = queryset.filter(is_read=False)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        # 唯一触发惰性同步的读接口
        sync_due_notifications(request.user)
        count = Notification.objects.filter(
            user=request.user,
            is_read=False,
            is_stale=False,
        ).count()
        return Response({"unread_count": count})

    @action(detail=False, methods=["post"])
    def read(self, request):
        serializer = ReadNotificationsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]
        updated = Notification.objects.filter(user=request.user, id__in=ids).update(
            is_read=True
        )
        return Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        updated = Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True
        )
        return Response({"updated": updated})
