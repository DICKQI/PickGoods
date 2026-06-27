from rest_framework import serializers

from ..models import JournalBook, JournalPage, JournalPageVersion
from ..utils import compress_image


class JournalPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalPage
        fields = (
            "id",
            "book",
            "title",
            "page_no",
            "width",
            "height",
            "background",
            "content",
            "preview_image",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "book", "page_no", "created_at", "updated_at")


class JournalPageVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalPageVersion
        fields = (
            "id",
            "page",
            "version_no",
            "content",
            "preview_image",
            "created_at",
        )
        read_only_fields = ("id", "page", "version_no", "content", "preview_image", "created_at")


class JournalBookListSerializer(serializers.ModelSerializer):
    page_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = JournalBook
        fields = (
            "id",
            "title",
            "description",
            "cover_image",
            "order",
            "page_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "order", "page_count", "created_at", "updated_at")


class JournalBookDetailSerializer(serializers.ModelSerializer):
    pages = JournalPageSerializer(many=True, read_only=True)

    class Meta:
        model = JournalBook
        fields = (
            "id",
            "title",
            "description",
            "cover_image",
            "order",
            "pages",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "order", "pages", "created_at", "updated_at")

    def create(self, validated_data):
        cover_image = validated_data.get("cover_image")
        if cover_image:
            compressed = compress_image(cover_image, max_size_kb=300)
            if compressed:
                validated_data["cover_image"] = compressed
        return super().create(validated_data)

    def update(self, instance, validated_data):
        cover_image = validated_data.get("cover_image")
        if cover_image:
            compressed = compress_image(cover_image, max_size_kb=300)
            if compressed:
                validated_data["cover_image"] = compressed
        return super().update(instance, validated_data)
