from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.goods.models import Category, Character, Goods, IP, Theme
from apps.goods.utils import compress_image
from core.permissions import is_admin

from .models import Notification, Preorder


class PreorderSerializer(serializers.ModelSerializer):
    """预购登记读写序列化器。

    - status / paid_at 只读：状态流转必须走专用 action（mark-paid / cancel / convert-to-goods）；
    - estimated_month 强制归一化为粒度起点（月粒度=当月 1 日，季度粒度=季度首月 1 日）；
    - time_granularity 决定展示与提醒粒度：month / quarter。
    """

    goods_id = serializers.SerializerMethodField()
    goods_name = serializers.SerializerMethodField()
    deposit_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=0, help_text="定金金额（≥0）"
    )
    balance_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=0,
        required=False,
        allow_null=True,
        help_text="尾款金额（未知可留空，≥0）",
    )

    class Meta:
        model = Preorder
        fields = (
            "id",
            "name",
            "platform",
            "shop_name",
            "order_no",
            "deposit_amount",
            "balance_amount",
            "estimated_month",
            "time_granularity",
            "status",
            "paid_at",
            "goods_id",
            "goods_name",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "paid_at",
            "goods_id",
            "goods_name",
            "created_at",
            "updated_at",
        )

    def validate_estimated_month(self, value):
        # 粒度起点归一化：月粒度存当月 1 日，季度粒度存季度首月 1 日
        return value.replace(day=1)

    def validate(self, attrs):
        # 季度粒度：无论传季度内哪个月，统一归一到季度首月
        granularity = attrs.get(
            "time_granularity",
            getattr(self.instance, "time_granularity", Preorder.GRANULARITY_MONTH),
        )
        month = attrs.get("estimated_month") or getattr(
            self.instance, "estimated_month", None
        )
        if granularity == Preorder.GRANULARITY_QUARTER and month is not None:
            quarter_start = ((month.month - 1) // 3) * 3 + 1
            if month.month != quarter_start:
                # 仅改粒度（PATCH 不含 estimated_month）时，回退用实例时间并写回 attrs
                attrs["estimated_month"] = month.replace(month=quarter_start)
        return attrs

    def get_goods_id(self, obj):
        return str(obj.goods_id) if obj.goods_id else None

    def get_goods_name(self, obj):
        return obj.goods.name if obj.goods_id else None


class ConvertPreorderToGoodsSerializer(serializers.Serializer):
    """转正为谷子专用序列化器。

    不复用 GoodsDetailSerializer，避免其 view 层逻辑
    （merge_strategy / user_id / 草稿校验 / 重复检测）干扰转换路径。
    请求体字段使用前端语义的 ip / category / characters（均为 ID），
    在 create 阶段映射为 Goods 的 ip_id / category_id / character_ids。
    """

    name = serializers.CharField(max_length=200, help_text="谷子名称（默认预填预购名）")
    ip = serializers.PrimaryKeyRelatedField(queryset=IP.objects.all(), help_text="IP作品ID")
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        help_text="品类ID",
    )
    characters = serializers.PrimaryKeyRelatedField(
        queryset=Character.objects.all(),
        many=True,
        required=False,
        allow_empty=True,
        help_text="角色ID列表；草稿状态可空，非草稿至少一个",
    )
    theme = serializers.PrimaryKeyRelatedField(
        queryset=Theme.objects.all(),
        required=False,
        allow_null=True,
        help_text="主题ID（可选，仅限当前用户的主题）",
    )
    status = serializers.ChoiceField(
        choices=Goods.STATUS_CHOICES,
        default="draft",
        required=False,
        help_text="默认草稿：转正后可在谷子编辑页补充图片等信息",
    )
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    main_photo = serializers.ImageField(required=False, allow_null=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None) if request is not None else None
        if user is not None and getattr(user, "id", None) and not is_admin(user):
            # 私有外键只允许指向当前用户的数据，避免越权关联
            self.fields["theme"].queryset = Theme.objects.filter(user=user)

    def validate(self, attrs):
        status_value = attrs.get("status", "draft")
        if status_value != "draft" and not attrs.get("characters"):
            raise serializers.ValidationError({"characters": "非草稿状态至少需要关联一个角色"})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        """创建谷子并完成金额 / 日期迁移（preorder / user 由视图通过 save() 注入）。"""
        preorder = validated_data.pop("preorder")
        user = validated_data.pop("user")
        characters = validated_data.pop("characters", [])
        main_photo = validated_data.pop("main_photo", None)
        if main_photo:
            compressed = compress_image(main_photo, max_size_kb=300)
            if compressed:
                validated_data["main_photo"] = compressed

        # 金额 / 日期自动迁移：price = 定金 + 尾款（尾款未知则仅定金）
        validated_data["price"] = preorder.deposit_amount + (
            preorder.balance_amount or Decimal("0.00")
        )
        if preorder.paid_at:
            validated_data["purchase_date"] = timezone.localtime(preorder.paid_at).date()
        else:
            validated_data["purchase_date"] = timezone.localdate()
        # 请求未提供备注时，回退沿用预购备注；显式传值以请求为准
        validated_data.setdefault("notes", preorder.notes)

        goods = Goods.objects.create(user=user, **validated_data)
        if characters:
            goods.characters.set(characters)
        return goods


class NotificationSerializer(serializers.ModelSerializer):
    """通知序列化器（只读）。"""

    preorder_id = serializers.SerializerMethodField()
    preorder_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            "id",
            "type",
            "title",
            "message",
            "preorder_id",
            "preorder_name",
            "is_read",
            "is_stale",
            "created_at",
        )
        read_only_fields = fields

    def get_preorder_id(self, obj):
        return str(obj.preorder_id) if obj.preorder_id else None

    def get_preorder_name(self, obj):
        return obj.preorder.name if obj.preorder_id else None


class ReadNotificationsSerializer(serializers.Serializer):
    """POST /api/notifications/read/ 请求体。"""

    ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=True,
        help_text="要标记为已读的通知ID列表",
    )
