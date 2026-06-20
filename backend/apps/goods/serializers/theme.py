"""
主题相关的序列化器
"""
from rest_framework import serializers

from apps.users.models import User as UserModel
from core.permissions import is_admin

from ..models import Character, IP, Theme, ThemeImage, ThemeTemplate
from ..utils import compress_image
from .character import CharacterSimpleSerializer
from .ip import IPSimpleSerializer


class ThemeImageSerializer(serializers.ModelSerializer):
    """主题附加图片序列化器"""

    class Meta:
        model = ThemeImage
        fields = ("id", "image", "label")

    def create(self, validated_data):
        """创建时自动压缩图片"""
        image = validated_data.get("image")
        if image:
            compressed_image = compress_image(image, max_size_kb=300)
            if compressed_image:
                validated_data["image"] = compressed_image
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """更新时自动压缩图片"""
        image = validated_data.get("image")
        if image:
            compressed_image = compress_image(image, max_size_kb=300)
            if compressed_image:
                validated_data["image"] = compressed_image
        return super().update(instance, validated_data)


class ThemeSimpleSerializer(serializers.ModelSerializer):
    """主题简单序列化器（用于列表和嵌套显示）"""

    class Meta:
        model = Theme
        fields = ("id", "name", "description", "created_at")


class ThemeTemplateSerializer(serializers.ModelSerializer):
    """Theme-linked defaults for creating the next goods item."""

    ip = IPSimpleSerializer(read_only=True)
    ip_id = serializers.PrimaryKeyRelatedField(
        queryset=IP.objects.all(),
        source="ip",
        write_only=True,
    )
    characters = CharacterSimpleSerializer(many=True, read_only=True)
    character_ids = serializers.PrimaryKeyRelatedField(
        queryset=Character.objects.all(),
        many=True,
        source="characters",
        write_only=True,
        required=False,
    )

    class Meta:
        model = ThemeTemplate
        fields = (
            "id",
            "theme",
            "name",
            "ip",
            "ip_id",
            "characters",
            "character_ids",
            "purchase_date",
            "is_official",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "theme", "created_at", "updated_at")

    def validate(self, attrs):
        ip = attrs.get("ip") or getattr(self.instance, "ip", None)
        characters = attrs.get("characters")
        if characters is None and self.instance is not None:
            characters = list(self.instance.characters.all())
        if ip is not None and characters is not None:
            invalid = [character.id for character in characters if character.ip_id != ip.id]
            if invalid:
                raise serializers.ValidationError(
                    {"character_ids": f"角色不属于所选 IP: {invalid}"}
                )
        return attrs

    def create(self, validated_data):
        characters = validated_data.pop("characters", [])
        instance = super().create(validated_data)
        instance.characters.set(characters)
        return instance

    def update(self, instance, validated_data):
        characters = validated_data.pop("characters", None)
        instance = super().update(instance, validated_data)
        if characters is not None:
            instance.characters.set(characters)
        return instance


class ThemeTemplatePayloadSerializer(serializers.Serializer):
    """Response shape for fetching template data and theme image pool."""

    template = ThemeTemplateSerializer(allow_null=True)
    images = ThemeImageSerializer(many=True)


class ThemeDetailSerializer(serializers.ModelSerializer):
    """主题详情序列化器（用于创建和更新）"""

    images = ThemeImageSerializer(many=True, read_only=True)
    template = ThemeTemplateSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=UserModel.objects.all(),
        write_only=True,
        required=False,
        help_text="仅管理员：指定主题归属用户；省略则归属当前登录用户",
    )

    class Meta:
        model = Theme
        fields = ("id", "name", "description", "created_at", "images", "template", "user_id")

    def validate_user_id(self, value):
        request = self.context.get("request")
        if not request or not is_admin(request.user):
            raise serializers.ValidationError("仅管理员可指定 user_id")
        return value

    def create(self, validated_data):
        validated_data.pop("user_id", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("user_id", None)
        return super().update(instance, validated_data)


