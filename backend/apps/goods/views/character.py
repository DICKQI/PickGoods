"""
角色（Character）相关的视图
"""
from decimal import Decimal

from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated
from rest_framework import filters as drf_filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Character, Goods
from ..serializers import CharacterSimpleSerializer
from core.permissions import IsAdminOrReadOnly, is_admin


class CharacterViewSet(viewsets.ModelViewSet):
    """
    角色CRUD接口。

    - list: 获取所有角色列表，支持按IP过滤
    - retrieve: 获取单个角色详情
    - create: 创建新角色
    - update: 更新角色
    - partial_update: 部分更新角色
    - destroy: 删除角色
    """

    queryset = Character.objects.all().select_related("ip").order_by("created_at")
    serializer_class = CharacterSimpleSerializer
    filter_backends = (DjangoFilterBackend, drf_filters.SearchFilter)
    search_fields = ("name", "ip__name", "ip__keywords__value")
    filterset_fields = {
        "ip": ["exact"],
        "name": ["exact", "icontains"],
    }
    permission_classes = [IsAdminOrReadOnly]

    @action(detail=True, methods=["get"], url_path="stats", permission_classes=[IsAuthenticated])
    def stats(self, request, pk=None):
        character = self.get_object()
        user = request.user

        def money_zero():
            return Value(Decimal("0.00"), output_field=DecimalField(max_digits=20, decimal_places=2))

        def goods_value_expr(prefix: str = ""):
            return ExpressionWrapper(
                F(f"{prefix}quantity") * Coalesce(F(f"{prefix}price"), money_zero()),
                output_field=DecimalField(max_digits=20, decimal_places=2),
            )

        visible_goods = Goods.objects.filter(characters=character)
        if not is_admin(user):
            visible_goods = visible_goods.filter(user=user)
        visible_goods = visible_goods.select_related("ip", "category").distinct()

        def decimal_to_money(value) -> str:
            if value is None:
                value = Decimal("0.00")
            if not isinstance(value, Decimal):
                value = Decimal(str(value))
            return str(value.quantize(Decimal("0.01")))

        def int_value(value) -> int:
            return int(value or 0)

        def percentile(value: Decimal | int, values: list[Decimal | int]) -> Decimal:
            if not values:
                return Decimal("0")
            if Decimal(str(value)) <= Decimal("0"):
                return Decimal("0")
            current = Decimal(str(value))
            count = sum(1 for item in values if Decimal(str(item)) <= current)
            return (Decimal(count) / Decimal(len(values))) * Decimal("100")

        def weighted_components(metrics: dict, all_metrics: list[dict], weights: dict[str, Decimal]) -> dict:
            components = {}
            for key, weight in weights.items():
                pct = percentile(metrics.get(key, 0), [item.get(key, 0) for item in all_metrics])
                contribution = (pct * weight).quantize(Decimal("0.01"))
                components[key] = {
                    "percentile": float(pct.quantize(Decimal("0.01"))),
                    "weight": float(weight),
                    "contribution": float(contribution),
                }
            return components

        def score_from_components(components: dict) -> int:
            score = sum(Decimal(str(item["contribution"])) for item in components.values())
            return int(score.quantize(Decimal("1")))

        def oshi_level(score: int) -> str:
            if score <= 0:
                return "未开厨"
            if score < 20:
                return "初识"
            if score < 40:
                return "心动"
            if score < 60:
                return "上头"
            if score < 80:
                return "本命"
            return "神推"

        def heat_level(score: int) -> str:
            if score <= 0:
                return "无热度"
            if score < 30:
                return "小众"
            if score < 60:
                return "升温"
            if score < 80:
                return "热门"
            return "爆热"

        def rank_for(target_id: int, scored: list[dict]) -> int | None:
            ranked = sorted(scored, key=lambda item: (-item["score"], item["name"]))
            for index, item in enumerate(ranked, start=1):
                if item["id"] == target_id:
                    return index
            return None

        overview = visible_goods.aggregate(
            goods_count=Count("id", distinct=True),
            quantity_sum=Coalesce(Sum("quantity"), Value(0)),
            value_sum=Coalesce(Sum(goods_value_expr()), money_zero()),
            category_count=Count("category", distinct=True),
        )
        overview_payload = {
            "goods_count": int_value(overview["goods_count"]),
            "quantity_sum": int_value(overview["quantity_sum"]),
            "value_sum": decimal_to_money(overview["value_sum"]),
            "category_count": int_value(overview["category_count"]),
        }

        def character_metrics_queryset():
            qs = Character.objects.select_related("ip")
            if not is_admin(user):
                qs = qs.filter(goods__user=user)
            else:
                qs = qs.filter(goods__isnull=False)
            return (
                qs.values("id", "name", "ip__name")
                .annotate(
                    goods_count=Count("goods", distinct=True),
                    quantity=Coalesce(Sum("goods__quantity"), Value(0)),
                    value=Coalesce(Sum(goods_value_expr("goods__")), money_zero()),
                    category_breadth=Count("goods__category", distinct=True),
                )
                .filter(goods_count__gt=0)
            )

        character_metric_rows = list(character_metrics_queryset())
        current_character_metrics = next(
            (row for row in character_metric_rows if row["id"] == character.id),
            {
                "id": character.id,
                "name": character.name,
                "ip__name": character.ip.name,
                "goods_count": 0,
                "quantity": 0,
                "value": Decimal("0.00"),
                "category_breadth": 0,
            },
        )
        oshi_weights = {
            "value": Decimal("0.45"),
            "quantity": Decimal("0.25"),
            "goods_count": Decimal("0.20"),
            "category_breadth": Decimal("0.10"),
        }
        oshi_components = weighted_components(current_character_metrics, character_metric_rows, oshi_weights)
        oshi_score = 0 if overview_payload["goods_count"] == 0 else score_from_components(oshi_components)
        scored_characters = []
        for row in character_metric_rows:
            components = weighted_components(row, character_metric_rows, oshi_weights)
            scored_characters.append({
                "id": row["id"],
                "name": row["name"],
                "ip_name": row["ip__name"],
                "score": score_from_components(components),
                "goods_count": int_value(row["goods_count"]),
                "quantity_sum": int_value(row["quantity"]),
                "value_sum": decimal_to_money(row["value"]),
            })

        status_dist = list(
            visible_goods.values("status")
            .annotate(goods_count=Count("id", distinct=True), quantity_sum=Coalesce(Sum("quantity"), Value(0)))
            .order_by("-goods_count")
        )
        status_label_map = dict(Goods.STATUS_CHOICES)
        for item in status_dist:
            item["label"] = status_label_map.get(item["status"], item["status"])

        official_dist = list(
            visible_goods.values("is_official")
            .annotate(goods_count=Count("id", distinct=True), quantity_sum=Coalesce(Sum("quantity"), Value(0)))
            .order_by("-goods_count")
        )
        for item in official_dist:
            item["label"] = "官谷" if item["is_official"] else "同人/非官谷"

        category_top = list(
            visible_goods.values("category_id", "category__name", "category__path_name", "category__color_tag")
            .annotate(
                goods_count=Count("id", distinct=True),
                quantity_sum=Coalesce(Sum("quantity"), Value(0)),
                value_sum=Coalesce(Sum(goods_value_expr()), money_zero()),
            )
            .order_by("-goods_count", "category__name")[:10]
        )
        for item in category_top:
            item["value_sum"] = decimal_to_money(item["value_sum"])

        purchase_trend = list(
            visible_goods.filter(purchase_date__isnull=False)
            .values("purchase_date")
            .annotate(
                goods_count=Count("id", distinct=True),
                quantity_sum=Coalesce(Sum("quantity"), Value(0)),
                value_sum=Coalesce(Sum(goods_value_expr()), money_zero()),
            )
            .order_by("purchase_date")
        )
        for item in purchase_trend:
            item["bucket"] = item.pop("purchase_date").isoformat()
            item["value_sum"] = decimal_to_money(item["value_sum"])

        created_trend = list(
            visible_goods.values("created_at__date")
            .annotate(goods_count=Count("id", distinct=True), quantity_sum=Coalesce(Sum("quantity"), Value(0)))
            .order_by("created_at__date")
        )
        for item in created_trend:
            bucket = item.pop("created_at__date")
            item["bucket"] = bucket.isoformat() if bucket else None

        recent_cutoff = timezone.now() - timezone.timedelta(days=30)

        def build_ip_metrics(goods_scope):
            grouped: dict[int, dict] = {}
            for good in (
                goods_scope.select_related("ip", "category", "user")
                .prefetch_related("characters")
                .distinct()
            ):
                item = grouped.setdefault(
                    good.ip_id,
                    {
                        "ip_id": good.ip_id,
                        "ip__name": good.ip.name,
                        "collectors_set": set(),
                        "quantity": 0,
                        "goods_count": 0,
                        "total_value": Decimal("0.00"),
                        "recent": 0,
                        "character_set": set(),
                        "category_set": set(),
                    },
                )
                item["collectors_set"].add(good.user_id)
                item["quantity"] += int_value(good.quantity)
                item["goods_count"] += 1
                item["total_value"] += Decimal(str(good.price or "0.00")) * Decimal(good.quantity)
                if good.created_at and good.created_at >= recent_cutoff:
                    item["recent"] += 1
                item["category_set"].add(good.category_id)
                item["character_set"].update(good.characters.values_list("id", flat=True))

            result = []
            for item in grouped.values():
                result.append({
                    "ip_id": item["ip_id"],
                    "ip__name": item["ip__name"],
                    "collectors": len(item["collectors_set"]),
                    "quantity": item["quantity"],
                    "goods_count": item["goods_count"],
                    "total_value": item["total_value"],
                    "recent": item["recent"],
                    "character_count": len(item["character_set"]),
                    "category_count": len(item["category_set"]),
                })
            return result

        def build_heat_payload(metrics: dict, all_metrics: list[dict], weights: dict[str, Decimal], target_id: int, *, platform: bool):
            components = weighted_components(metrics, all_metrics, weights)
            score = 0 if not metrics or metrics.get("goods_count", 0) == 0 else score_from_components(components)
            scored = []
            for row in all_metrics:
                row_components = weighted_components(row, all_metrics, weights)
                scored.append({
                    "id": row["ip_id"],
                    "name": row["ip__name"],
                    "score": score_from_components(row_components),
                })
            raw_metrics = {
                "goods_count": int_value(metrics.get("goods_count", 0)),
                "quantity_sum": int_value(metrics.get("quantity", 0)),
                "value_sum": decimal_to_money(metrics.get("total_value", Decimal("0.00"))),
                "recent_goods_count": int_value(metrics.get("recent", 0)),
            }
            if platform:
                raw_metrics["collectors_count"] = int_value(metrics.get("collectors", 0))
            else:
                raw_metrics["character_count"] = int_value(metrics.get("character_count", 0))
                raw_metrics["category_count"] = int_value(metrics.get("category_count", 0))
            return {
                "score": score,
                "level": heat_level(score),
                "rank": rank_for(target_id, scored),
                "total_ips": len(all_metrics),
                "components": components,
                "raw_metrics": raw_metrics,
            }

        all_platform_ip_metrics = build_ip_metrics(Goods.objects.all())
        current_platform_ip_metrics = next(
            (row for row in all_platform_ip_metrics if row["ip_id"] == character.ip_id),
            {"ip_id": character.ip_id, "ip__name": character.ip.name, "collectors": 0, "quantity": 0, "goods_count": 0, "total_value": Decimal("0.00"), "recent": 0},
        )
        platform_heat = build_heat_payload(
            current_platform_ip_metrics,
            all_platform_ip_metrics,
            {
                "collectors": Decimal("0.45"),
                "quantity": Decimal("0.20"),
                "goods_count": Decimal("0.15"),
                "total_value": Decimal("0.10"),
                "recent": Decimal("0.10"),
            },
            character.ip_id,
            platform=True,
        )

        my_ip_metrics = build_ip_metrics(Goods.objects.filter(user=user))
        current_my_ip_metrics = next(
            (row for row in my_ip_metrics if row["ip_id"] == character.ip_id),
            {"ip_id": character.ip_id, "ip__name": character.ip.name, "quantity": 0, "goods_count": 0, "total_value": Decimal("0.00"), "recent": 0, "character_count": 0, "category_count": 0},
        )
        my_heat = build_heat_payload(
            current_my_ip_metrics,
            my_ip_metrics,
            {
                "quantity": Decimal("0.30"),
                "goods_count": Decimal("0.25"),
                "total_value": Decimal("0.20"),
                "character_count": Decimal("0.15"),
                "category_count": Decimal("0.10"),
            },
            character.ip_id,
            platform=False,
        )

        payload = {
            "character": CharacterSimpleSerializer(character, context={"request": request}).data,
            "overview": overview_payload,
            "oshi_power": {
                "score": oshi_score,
                "level": oshi_level(oshi_score),
                "rank": rank_for(character.id, scored_characters),
                "total_characters": len(character_metric_rows),
                "components": oshi_components,
                "raw_metrics": {
                    "goods_count": overview_payload["goods_count"],
                    "quantity_sum": overview_payload["quantity_sum"],
                    "value_sum": overview_payload["value_sum"],
                    "category_count": overview_payload["category_count"],
                },
            },
            "ip_heat": {
                "ip": {
                    "id": character.ip.id,
                    "name": character.ip.name,
                    "subject_type": character.ip.subject_type,
                },
                "platform_heat": platform_heat,
                "my_heat": my_heat,
            },
            "distributions": {
                "status": status_dist,
                "is_official": official_dist,
                "category_top": category_top,
            },
            "trends": {
                "purchase_date": purchase_trend,
                "created_at": created_trend,
            },
            "rankings": {
                "global_top": sorted(scored_characters, key=lambda item: (-item["score"], item["name"]))[:10],
                "current": next((item for item in scored_characters if item["id"] == character.id), None),
            },
        }
        return Response(payload)
