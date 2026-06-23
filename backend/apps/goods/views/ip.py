"""
IP作品相关的视图
"""
from django.db import transaction
from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..bgm_service import get_characters, get_subject_info
from ..bgm_sync import apply_bgm_sync, compute_bgm_diff
from ..models import IP
from core.permissions import IsAdminOrReadOnly
from ..serializers import (
    BGMSyncApplyRequestSerializer,
    BGMSyncApplyResponseSerializer,
    BGMSyncPreviewRequestSerializer,
    BGMSyncPreviewResponseSerializer,
    CharacterSimpleSerializer,
    IPBatchUpdateOrderSerializer,
    IPDetailSerializer,
    IPSimpleSerializer,
)


class IPViewSet(viewsets.ModelViewSet):
    """
    IP作品CRUD接口。

    - list: 获取所有IP作品列表（包含关键词）
    - retrieve: 获取单个IP作品详情（包含关键词）
    - create: 创建新IP作品（支持同时创建关键词）
    - update: 更新IP作品（支持同时更新关键词）
    - partial_update: 部分更新IP作品（支持同时更新关键词）
    - destroy: 删除IP作品
    - characters: 获取指定IP下的所有角色列表（/api/ips/{id}/characters/）
    - batch_update_order: 批量更新IP作品排序（用于拖拽排序等功能）
    """

    filter_backends = (DjangoFilterBackend, drf_filters.SearchFilter)
    search_fields = ("name", "keywords__value")
    filterset_fields = {
        "name": ["exact", "icontains"],
        "subject_type": ["exact", "in"],  # exact: 精确匹配，in: 多值筛选（逗号分隔）
    }
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        """优化查询，预加载关键词并统计角色数量"""
        return (
            IP.objects.all()
            .prefetch_related("keywords")
            .annotate(character_count=Count("characters"))
            .order_by("order", "id")
        )

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action in ("create", "update", "partial_update"):
            return IPDetailSerializer
        return IPSimpleSerializer

    @action(detail=True, methods=["get"], url_path="characters")
    def characters(self, request, pk=None):
        """
        获取指定IP下的所有角色列表
        URL: /api/ips/{id}/characters/
        """
        ip = self.get_object()
        characters = ip.characters.all().select_related("ip").order_by("created_at")
        serializer = CharacterSimpleSerializer(
            characters, many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="batch-update-order")
    def batch_update_order(self, request):
        """
        批量更新IP作品排序接口
        URL: /api/ips/batch-update-order/

        用于前端通过拖拽等方式调整IP作品顺序后，批量更新排序值。
        支持同时更新多个IP作品的order字段。
        """
        serializer = IPBatchUpdateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        items = serializer.validated_data["items"]

        ip_ids = [item["id"] for item in items]
        existing_ips = IP.objects.filter(id__in=ip_ids)
        existing_ids = set(existing_ips.values_list("id", flat=True))

        missing_ids = set(ip_ids) - existing_ids
        if missing_ids:
            return Response(
                {"detail": f"以下IP作品ID不存在: {sorted(missing_ids)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                ip_dict = {obj.id: obj for obj in existing_ips}

                updated_ips = []
                for item in items:
                    ip_obj = ip_dict[item["id"]]
                    ip_obj.order = item["order"]
                    ip_obj.save(update_fields=["order"])
                    updated_ips.append(ip_obj)

                updated_ids = [obj.id for obj in updated_ips]
                result_ips = IP.objects.filter(id__in=updated_ids).order_by("order", "id")
                result_serializer = IPSimpleSerializer(
                    result_ips, many=True, context={"request": request}
                )

                return Response(
                    {
                        "detail": f"成功更新 {len(updated_ips)} 个IP作品的排序",
                        "updated_count": len(updated_ips),
                        "ips": result_serializer.data,
                    },
                    status=status.HTTP_200_OK,
                )
        except Exception as e:
            return Response(
                {"detail": f"更新排序失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    # ==================== BGM 增量同步 ====================

    def _resolve_bgm_subject_id(self, ip, payload_subject_id):
        """统一处理 subject_id 来源（请求传入优先，否则使用 IP 已绑定）

        返回 (subject_id, error_response)。error_response 不为 None 时直接返回它。
        若请求传入了与已绑定不一致的 subject_id，视为冲突。
        """
        bound = ip.bgm_subject_id
        if payload_subject_id is None:
            if bound is None:
                return None, Response(
                    {"detail": "该IP尚未绑定 BGM 作品，请在请求中传入 subject_id"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return bound, None

        if bound is not None and bound != payload_subject_id:
            return None, Response(
                {
                    "detail": (
                        f"该IP已绑定 BGM subject_id={bound}，与请求中的 "
                        f"{payload_subject_id} 不一致"
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        # 校验目标 subject_id 是否被其它 IP 占用
        conflict = (
            IP.objects.filter(bgm_subject_id=payload_subject_id)
            .exclude(pk=ip.pk)
            .first()
        )
        if conflict is not None:
            return None, Response(
                {
                    "detail": (
                        f"BGM subject_id={payload_subject_id} 已被 IP "
                        f"'{conflict.name}'(id={conflict.id}) 占用"
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        return payload_subject_id, None

    @action(detail=True, methods=["post"], url_path="bgm-preview",
            serializer_class=BGMSyncPreviewRequestSerializer)
    def bgm_preview(self, request, pk=None):
        """
        从 BGM 拉取最新角色列表并计算 diff 预览（不写库）。
        URL: /api/ips/{id}/bgm-preview/

        - 若 IP 已经绑定 bgm_subject_id，可不传 subject_id；
        - 历史 IP 首次同步时需在请求中传入 subject_id。
        """
        ip = self.get_object()
        req = BGMSyncPreviewRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        payload_subject_id = req.validated_data.get("subject_id")

        subject_id, err = self._resolve_bgm_subject_id(ip, payload_subject_id)
        if err is not None:
            return err

        try:
            subject_info = get_subject_info(subject_id)
            if not subject_info:
                return Response(
                    {"detail": f"未找到 BGM subject_id={subject_id}"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            bgm_characters = get_characters(subject_id)
        except Exception as e:
            return Response(
                {"detail": f"获取 BGM 数据失败: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        diff = compute_bgm_diff(ip, bgm_characters)
        bgm_subject_type = subject_info.get("type")
        subject_type_will_update = (
            bgm_subject_type is not None and ip.subject_type != bgm_subject_type
        )
        will_link_subject = ip.bgm_subject_id is None

        payload = {
            "ip_id": ip.id,
            "ip_name": ip.name,
            "bgm_subject_id": subject_id,
            "bgm_subject_name": subject_info.get("display_name") or "",
            "bgm_subject_type": bgm_subject_type,
            "subject_type_will_update": subject_type_will_update,
            "will_link_subject": will_link_subject,
            "items": diff["items"],
            "summary": diff["summary"],
        }
        response_serializer = BGMSyncPreviewResponseSerializer(data=payload)
        response_serializer.is_valid(raise_exception=True)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="bgm-sync",
            serializer_class=BGMSyncApplyRequestSerializer)
    def bgm_sync(self, request, pk=None):
        """
        应用用户确认的 BGM diff：新增缺失角色 / 回填 bgm_character_id / 可选同步 subject_type。
        URL: /api/ips/{id}/bgm-sync/

        为保证服务端真相一致，apply 阶段会**重拉**一次 BGM subject 信息以获取最新 subject_type；
        但角色列表以请求中传入的 items 为准（前端已基于 preview 让用户勾选过）。
        """
        ip = self.get_object()
        req = BGMSyncApplyRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        payload_subject_id = req.validated_data.get("subject_id")
        items = req.validated_data["items"]
        update_subject_type = req.validated_data.get("update_subject_type", True)

        subject_id, err = self._resolve_bgm_subject_id(ip, payload_subject_id)
        if err is not None:
            return err

        bgm_subject_type = None
        try:
            subject_info = get_subject_info(subject_id)
            if not subject_info:
                return Response(
                    {"detail": f"未找到 BGM subject_id={subject_id}"},
                    status=status.HTTP_404_NOT_FOUND,
                )
            bgm_subject_type = subject_info.get("type")
        except Exception as e:
            # 取不到 subject_info 不阻塞新增/回填，只是无法更新 subject_type
            bgm_subject_type = None
            _ = e

        try:
            result = apply_bgm_sync(
                ip=ip,
                bgm_subject_id=subject_id,
                items=[dict(it) for it in items],
                bgm_subject_type=bgm_subject_type,
                update_subject_type=update_subject_type,
            )
        except Exception as e:
            return Response(
                {"detail": f"同步失败: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        response_serializer = BGMSyncApplyResponseSerializer(data=result)
        response_serializer.is_valid(raise_exception=True)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
