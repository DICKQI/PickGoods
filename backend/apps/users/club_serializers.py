from urllib.parse import urlparse

from rest_framework import serializers

from apps.goods.models import (
    Category,
    Character,
    ClubCatalogImage,
    ClubCatalogItem,
    Goods,
    IP,
    Theme,
)
from apps.goods.serializers.category import CategorySimpleSerializer
from apps.goods.serializers.character import CharacterSimpleSerializer
from apps.goods.serializers.ip import IPSimpleSerializer
from apps.goods.serializers.theme import ThemeSimpleSerializer
from apps.goods.utils import compress_image

from .models import Club, User


def normalize_store_links(value):
    """只允许公开跳转到 HTTP(S) 地址，避免把危险协议写入公开资料。"""
    if value is None:
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError("店铺链接必须是数组")
    result = []
    for item in value:
        if not isinstance(item, dict):
            raise serializers.ValidationError("每条店铺链接必须包含 url")
        url = str(item.get("url") or "").strip()
        parsed = urlparse(url)
        if not url or parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
            raise serializers.ValidationError("店铺链接必须是 http 或 https URL")
        result.append({"label": str(item.get("label") or "店铺").strip(), "url": url})
    return result


def normalize_optional_url(value):
    """Normalize an optional platform URL while restricting schemes to HTTP(S)."""
    if value is None:
        return None
    url = str(value).strip()
    if not url:
        return None
    parsed = urlparse(url)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.netloc:
        raise serializers.ValidationError("链接必须是 http 或 https URL")
    return url


class ClubSerializer(serializers.ModelSerializer):
    avatar = serializers.SerializerMethodField()
    goods_count = serializers.SerializerMethodField()

    class Meta:
        model = Club
        fields = (
            "id", "name", "avatar", "description", "announcement",
            "contact_name", "contact_phone", "contact_email",
            "taobao_url", "xiaohongshu_url", "weidian_url", "store_links",
            "address", "business_hours", "goods_count", "created_at", "updated_at",
        )
        read_only_fields = ("id", "goods_count", "created_at", "updated_at")
        extra_kwargs = {"name": {"allow_blank": False}}

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        url = obj.avatar.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_goods_count(self, obj):
        annotated_count = getattr(obj, "listed_goods_count", None)
        if annotated_count is not None:
            return annotated_count
        return ClubCatalogItem.objects.filter(
            club=obj,
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        ).count()

    def validate_name(self, value):
        name = str(value or "").strip()
        if not name:
            raise serializers.ValidationError("社团名称不能为空")
        queryset = Club.objects.filter(name=name)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("社团名称已存在")
        return name

    def validate_store_links(self, value):
        return normalize_store_links(value)

    def validate_taobao_url(self, value):
        return normalize_optional_url(value)

    def validate_xiaohongshu_url(self, value):
        return normalize_optional_url(value)

    def validate_weidian_url(self, value):
        return normalize_optional_url(value)


class ClubDirectoryPreviewSerializer(serializers.ModelSerializer):
    """目录页使用的轻量条目预览，避免下发完整的社团商品详情。"""

    preview_photo = serializers.SerializerMethodField()

    class Meta:
        model = ClubCatalogItem
        fields = ("id", "name", "preview_photo", "public_price", "is_official")
        read_only_fields = fields

    def get_preview_photo(self, obj):
        image = obj.main_photo if obj.main_photo and obj.main_photo.name else None
        if image is None:
            additional_photos = getattr(obj, "directory_additional_photos", None)
            if additional_photos is None:
                additional_photos = list(obj.additional_photos.all()[:1])
            image = additional_photos[0].image if additional_photos else None
        if not image or not image.name:
            return None
        url = image.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class ClubDirectorySerializer(ClubSerializer):
    """社团目录列表响应，在基础资料上附带有界的最新条目预览。"""

    preview_goods = serializers.SerializerMethodField()

    class Meta(ClubSerializer.Meta):
        fields = ClubSerializer.Meta.fields + ("preview_goods",)
        read_only_fields = ClubSerializer.Meta.read_only_fields + ("preview_goods",)

    def get_preview_goods(self, obj):
        items = getattr(obj, "directory_preview_goods", [])
        return ClubDirectoryPreviewSerializer(items, many=True, context=self.context).data


class ClubRegistrationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)


class ClubPopularitySerializer(serializers.Serializer):
    goods_id = serializers.UUIDField()
    goods_name = serializers.CharField()
    intended_user_count = serializers.IntegerField()
    acquired_user_count = serializers.IntegerField()


class ClubCatalogImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClubCatalogImage
        fields = ("id", "image", "label")
        read_only_fields = ("id",)


class ClubCatalogItemSerializer(serializers.ModelSerializer):
    ip = IPSimpleSerializer(read_only=True)
    ip_id = serializers.PrimaryKeyRelatedField(queryset=IP.objects.all(), source="ip", write_only=True)
    characters = CharacterSimpleSerializer(many=True, read_only=True)
    character_ids = serializers.PrimaryKeyRelatedField(
        queryset=Character.objects.all(), many=True, source="characters", write_only=True, required=False
    )
    category = CategorySimpleSerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), source="category", write_only=True)
    theme = ThemeSimpleSerializer(read_only=True)
    theme_id = serializers.PrimaryKeyRelatedField(
        queryset=Theme.objects.all(), source="theme", write_only=True, required=False, allow_null=True
    )
    additional_photos = ClubCatalogImageSerializer(many=True, read_only=True)

    class Meta:
        model = ClubCatalogItem
        fields = (
            "id", "club", "name", "description", "ip", "ip_id", "characters", "character_ids",
            "category", "category_id", "theme", "theme_id", "main_photo", "additional_photos",
            "public_price", "is_official", "publication_status", "order", "created_at", "updated_at",
        )
        read_only_fields = ("id", "club", "created_at", "updated_at", "additional_photos")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        club = self.context.get("club")
        if club is not None:
            self.fields["theme_id"].queryset = Theme.objects.filter(user=club.user)

    def validate(self, attrs):
        publication_status = attrs.get(
            "publication_status",
            getattr(self.instance, "publication_status", ClubCatalogItem.PUBLICATION_DRAFT),
        )
        characters = attrs.get("characters")
        if publication_status == ClubCatalogItem.PUBLICATION_LISTED:
            if self.instance is None and not characters:
                raise serializers.ValidationError({"character_ids": "上架时至少选择一个角色"})
            if self.instance is not None and characters is None and not self.instance.characters.exists():
                raise serializers.ValidationError({"character_ids": "上架时至少选择一个角色"})
            if characters is not None and not characters:
                raise serializers.ValidationError({"character_ids": "上架时至少选择一个角色"})
        return attrs

    def create(self, validated_data):
        characters = validated_data.pop("characters", [])
        main_photo = validated_data.get("main_photo")
        if main_photo:
            compressed = compress_image(main_photo, max_size_kb=300)
            if compressed:
                validated_data["main_photo"] = compressed
        instance = super().create(validated_data)
        instance.characters.set(characters)
        return instance

    def update(self, instance, validated_data):
        characters = validated_data.pop("characters", None)
        main_photo = validated_data.get("main_photo")
        if main_photo:
            compressed = compress_image(main_photo, max_size_kb=300)
            if compressed:
                validated_data["main_photo"] = compressed
        instance = super().update(instance, validated_data)
        if characters is not None:
            instance.characters.set(characters)
        return instance


class ClubCatalogPublicSerializer(serializers.ModelSerializer):
    ip = IPSimpleSerializer(read_only=True)
    characters = CharacterSimpleSerializer(many=True, read_only=True)
    category = CategorySimpleSerializer(read_only=True)
    theme = ThemeSimpleSerializer(read_only=True)
    additional_photos = ClubCatalogImageSerializer(many=True, read_only=True)

    class Meta:
        model = ClubCatalogItem
        fields = (
            "id", "name", "description", "ip", "characters", "category", "theme", "main_photo",
            "additional_photos", "public_price", "is_official",
        )
        read_only_fields = fields


class ClubImportSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("draft", "intended", "in_cabinet", "outdoor", "sold"))
    quantity = serializers.IntegerField(min_value=1, default=1)
    confirm_duplicate = serializers.BooleanField(default=False)
    name = serializers.CharField(max_length=200, required=False)
    ip_id = serializers.PrimaryKeyRelatedField(queryset=IP.objects.all(), required=False)
    category_id = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all(), required=False)
    character_ids = serializers.PrimaryKeyRelatedField(queryset=Character.objects.all(), many=True, required=False)
    theme_id = serializers.PrimaryKeyRelatedField(queryset=Theme.objects.all(), allow_null=True, required=False)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True, required=False)
    purchase_date = serializers.DateField(allow_null=True, required=False)
    notes = serializers.CharField(allow_blank=True, allow_null=True, required=False)
    is_official = serializers.BooleanField(required=False)


class ClubImportTemplateSerializer(serializers.Serializer):
    source_item_id = serializers.UUIDField()
    source = ClubCatalogPublicSerializer()
    defaults = serializers.DictField()
    existing = serializers.DictField(allow_null=True)


__all__ = [
    "ClubSerializer",
    "ClubDirectoryPreviewSerializer",
    "ClubDirectorySerializer",
    "ClubRegistrationSerializer",
    "ClubPopularitySerializer",
    "ClubCatalogImageSerializer",
    "ClubCatalogItemSerializer",
    "ClubCatalogPublicSerializer",
    "ClubImportSerializer",
    "ClubImportTemplateSerializer",
    "normalize_store_links",
    "normalize_optional_url",
]
