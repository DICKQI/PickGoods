from django.db import transaction
from django.db.models import Count
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.goods.models import Goods
from apps.goods.serializers import GoodsListSerializer

from .models import StorageNode
from .serializers import StorageNodeSerializer, StorageNodeTreeSerializer
from .services import get_descendant_ids, make_path_name, refresh_descendant_paths
from core.permissions import IsOwnerOnly, is_admin


class LocationGoodsPagination(PageNumberPagination):
    page_size = 18
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


class StorageNodeListCreateView(generics.ListCreateAPIView):
    """
    基础的收纳节点列表 / 创建接口。
    一般后台维护使用，非高频调用。
    """

    queryset = StorageNode.objects.all().order_by("order", "id")
    serializer_class = StorageNodeSerializer
    permission_classes = [IsOwnerOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "id", None):
            return qs.none()
        if is_admin(user):
            return qs
        return qs.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class StorageNodeDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    收纳节点详情 / 更新 / 删除接口。
    
    - GET: 获取单个节点详情
    - PUT/PATCH: 更新节点信息
    - DELETE: 删除节点及其所有子节点，并取消关联的商品
    """

    queryset = StorageNode.objects.all()
    serializer_class = StorageNodeSerializer
    permission_classes = [IsOwnerOnly]

    def get_queryset(self):
        """优化查询，预加载父节点和子节点"""
        qs = StorageNode.objects.select_related("parent").prefetch_related("children")
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "id", None):
            return qs.none()
        if is_admin(user):
            return qs
        return qs.filter(user=user)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        """
        删除节点时：
        1. 递归获取所有子节点（包括子节点的子节点）
        2. 取消所有节点关联的商品（将商品的 location 设置为 null）
        3. 删除根节点（由于 CASCADE，删除父节点会自动删除所有子节点）
        """
        instance = self.get_object()
        
        node_ids = get_descendant_ids(instance)
        
        # 取消所有关联的商品（将 location 设置为 null）
        # 虽然 Goods 的 location 使用了 on_delete=models.SET_NULL，
        # 但为了确保在删除前显式处理，我们先取消关联
        from apps.goods.models import Goods
        Goods.objects.filter(user=instance.user, location_id__in=node_ids).update(location=None)
        
        # 删除根节点（由于 parent 字段使用了 on_delete=models.CASCADE，
        # 删除父节点时，Django 会自动删除所有子节点）
        instance.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class StorageNodeTreeView(generics.ListAPIView):
    """
    位置树一次性下发接口：
    - 返回所有节点的扁平列表（带 parent），前端在 Pinia 中组装为树。
    - 更新频率极低，后续可在此视图外层加缓存（例如 Redis）。
    """

    queryset = StorageNode.objects.all().order_by("path_name", "order")
    serializer_class = StorageNodeTreeSerializer
    permission_classes = [IsOwnerOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "id", None):
            return qs.none()
        if is_admin(user):
            return qs
        return qs.filter(user=user)

    def list(self, request, *args, **kwargs):
        queryset = list(self.get_queryset())
        goods_count_qs = Goods.objects.filter(location_id__in=[node.id for node in queryset])
        if not is_admin(request.user):
            goods_count_qs = goods_count_qs.filter(user=request.user)
        direct_counts = {
            item["location_id"]: item["goods_count"]
            for item in goods_count_qs.values("location_id")
            .annotate(goods_count=Count("id"))
        }
        descendant_cache: dict[int, int] = {}

        for node in queryset:
            node.goods_count = direct_counts.get(node.id, 0)

        nodes_by_parent: dict[int | None, list[StorageNode]] = {}
        for node in queryset:
            nodes_by_parent.setdefault(node.parent_id, []).append(node)

        def count_descendants(node_id: int) -> int:
            if node_id in descendant_cache:
                return descendant_cache[node_id]
            total = direct_counts.get(node_id, 0)
            for child in nodes_by_parent.get(node_id, []):
                total += count_descendants(child.id)
            descendant_cache[node_id] = total
            return total

        for node in queryset:
            node.descendant_goods_count = count_descendants(node.id)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class StorageNodeGoodsView(generics.ListAPIView):
    """
    获取收纳节点下的所有商品接口。
    
    - GET: 获取指定节点下的所有商品列表
    - 支持查询参数 include_children：是否包含子节点下的商品（默认 false，只查询当前节点）
    """

    serializer_class = GoodsListSerializer
    permission_classes = [IsOwnerOnly]
    pagination_class = LocationGoodsPagination

    def get_queryset(self):
        """
        根据节点 ID 获取商品列表。
        如果 include_children=true，则包含所有子节点下的商品。
        """
        node_id = self.kwargs.get("pk")
        include_children = self.request.query_params.get("include_children", "false").lower() == "true"

        try:
            node_qs = StorageNode.objects.all()
            if not is_admin(self.request.user):
                node_qs = node_qs.filter(user=self.request.user)
            node = node_qs.get(pk=node_id)
        except StorageNode.DoesNotExist:
            return Goods.objects.none()

        # 如果包含子节点，需要获取所有子节点 ID
        node_ids = get_descendant_ids(node) if include_children else [node.id]

        # 查询商品，使用优化查询避免 N+1 问题
        goods_qs = Goods.objects.all()
        if not is_admin(self.request.user):
            goods_qs = goods_qs.filter(user=self.request.user)

        queryset = (
            goods_qs.filter(location_id__in=node_ids)
            .select_related("ip", "category", "location")
            .prefetch_related("characters__ip", "additional_photos")
            .order_by("-created_at")
        )

        return queryset


class StorageNodeSummaryView(APIView):
    permission_classes = [IsOwnerOnly]

    def get_node(self, pk):
        qs = StorageNode.objects.all()
        if not is_admin(self.request.user):
            qs = qs.filter(user=self.request.user)
        return qs.get(pk=pk)

    def get(self, request, pk):
        try:
            node = self.get_node(pk)
        except StorageNode.DoesNotExist:
            return Response({"detail": "位置不存在"}, status=status.HTTP_404_NOT_FOUND)

        descendant_ids = get_descendant_ids(node)
        direct_qs = Goods.objects.filter(location=node)
        descendant_qs = Goods.objects.filter(location_id__in=descendant_ids)
        if not is_admin(request.user):
            direct_qs = direct_qs.filter(user=request.user)
            descendant_qs = descendant_qs.filter(user=request.user)

        status_distribution = {
            item["status"]: item["goods_count"]
            for item in descendant_qs.values("status").annotate(goods_count=Count("id"))
        }
        recent_goods = descendant_qs.select_related("ip", "category", "location", "theme", "user").prefetch_related(
            "characters__ip", "additional_photos"
        ).order_by("-created_at")[:6]
        capacity = node.capacity
        descendant_count = descendant_qs.count()
        usage_ratio = None
        if capacity:
            usage_ratio = round(descendant_count / capacity, 4)

        return Response(
            {
                "node_id": node.id,
                "direct_goods_count": direct_qs.count(),
                "descendant_goods_count": descendant_count,
                "child_node_count": StorageNode.objects.filter(parent=node).count(),
                "capacity": capacity,
                "capacity_usage_ratio": usage_ratio,
                "status_distribution": status_distribution,
                "recent_goods": GoodsListSerializer(recent_goods, many=True, context={"request": request}).data,
            }
        )


class StorageNodeMoveView(APIView):
    permission_classes = [IsOwnerOnly]

    @transaction.atomic
    def post(self, request, pk):
        node_qs = StorageNode.objects.select_for_update()
        if not is_admin(request.user):
            node_qs = node_qs.filter(user=request.user)
        try:
            node = node_qs.get(pk=pk)
        except StorageNode.DoesNotExist:
            return Response({"detail": "位置不存在"}, status=status.HTTP_404_NOT_FOUND)

        parent_id = request.data.get("parent", node.parent_id)
        order = request.data.get("order", node.order)
        parent = None
        if parent_id is not None:
            parent_qs = StorageNode.objects.all()
            if not is_admin(request.user):
                parent_qs = parent_qs.filter(user=request.user)
            try:
                parent = parent_qs.get(pk=parent_id)
            except StorageNode.DoesNotExist:
                return Response({"detail": "父位置不存在"}, status=status.HTTP_400_BAD_REQUEST)

            if parent.id in get_descendant_ids(node):
                return Response({"detail": "不能移动到自身或子位置下"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = int(order)
        except (TypeError, ValueError):
            return Response({"detail": "order 必须是整数"}, status=status.HTTP_400_BAD_REQUEST)

        node.parent = parent
        node.order = order
        node.path_name = make_path_name(node.name, parent)
        node.save(update_fields=["parent", "order", "path_name", "updated_at"])
        refresh_descendant_paths(node)
        return Response(StorageNodeSerializer(node, context={"request": request}).data)


class LocationMoveGoodsView(APIView):
    permission_classes = [IsOwnerOnly]

    @transaction.atomic
    def post(self, request):
        goods_ids = request.data.get("goods_ids") or []
        target_location_id = request.data.get("target_location")
        if not isinstance(goods_ids, list) or not goods_ids:
            return Response({"detail": "goods_ids 不能为空"}, status=status.HTTP_400_BAD_REQUEST)

        target_location = None
        if target_location_id is not None:
            target_qs = StorageNode.objects.all()
            if not is_admin(request.user):
                target_qs = target_qs.filter(user=request.user)
            try:
                target_location = target_qs.get(pk=target_location_id)
            except StorageNode.DoesNotExist:
                return Response({"detail": "目标位置不存在"}, status=status.HTTP_400_BAD_REQUEST)

        goods_qs = Goods.objects.filter(id__in=goods_ids)
        if not is_admin(request.user):
            goods_qs = goods_qs.filter(user=request.user)
        if goods_qs.count() != len(set(goods_ids)):
            return Response({"detail": "谷子不存在或无权移动"}, status=status.HTTP_404_NOT_FOUND)

        moved_count = goods_qs.update(location=target_location)
        return Response({"moved_count": moved_count, "target_location": target_location_id})


class LocationUnassignedGoodsView(generics.ListAPIView):
    serializer_class = GoodsListSerializer
    permission_classes = [IsOwnerOnly]
    pagination_class = LocationGoodsPagination

    def get_queryset(self):
        qs = (
            Goods.objects.filter(location__isnull=True)
            .select_related("ip", "category", "location", "theme", "user")
            .prefetch_related("characters__ip", "additional_photos")
            .order_by("-created_at")
        )
        if is_admin(self.request.user):
            return qs
        return qs.filter(user=self.request.user)

