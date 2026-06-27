import re

from rest_framework import serializers

from ..models import JournalBook, JournalPage, JournalPageVersion
from ..utils import compress_image


HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
BRUSH_TYPES = {"pencil", "pen", "watercolor"}
LAYER_TYPES = {"sticker", "text", "draw"}
MAX_LAYERS = 200
MAX_ITEMS_PER_LAYER = 1000
MAX_DRAW_POINTS = 12000


def validate_journal_content(value):
    if not isinstance(value, dict):
        raise serializers.ValidationError("content must be an object")
    version = value.get("version")
    if version not in (1, 2):
        raise serializers.ValidationError({"version": "Only journal content version 1 or 2 is supported"})
    layers = value.get("layers")
    if not isinstance(layers, list):
        raise serializers.ValidationError({"layers": "layers must be a list"})
    if len(layers) > MAX_LAYERS:
        raise serializers.ValidationError({"layers": f"layers cannot exceed {MAX_LAYERS}"})

    if version == 2:
        return validate_journal_content_v2(value, layers)

    return validate_journal_content_v1(value, layers)


def validate_layer_identity(layer, index, seen_ids):
    if not isinstance(layer, dict):
        raise serializers.ValidationError({"layers": f"layer {index} must be an object"})
    layer_id = layer.get("id")
    if not isinstance(layer_id, str) or not layer_id:
        raise serializers.ValidationError({"id": f"layer {index} id is required"})
    if layer_id in seen_ids:
        raise serializers.ValidationError({"id": f"duplicate layer id {layer_id}"})
    seen_ids.add(layer_id)
    layer_type = layer.get("type")
    if layer_type not in LAYER_TYPES:
        raise serializers.ValidationError({"type": f"unsupported layer type {layer_type}"})
    z_index = layer.get("z_index")
    if not isinstance(z_index, int) or z_index < 0:
        raise serializers.ValidationError({"z_index": f"layer {layer_id} z_index must be a non-negative integer"})
    return layer_id, layer_type


def validate_opacity(value_num, field_name, owner_id):
    if not isinstance(value_num, (int, float)) or value_num < 0 or value_num > 1:
        raise serializers.ValidationError({field_name: f"{owner_id} {field_name} is out of range"})


def validate_position_fields(obj, owner_id):
    for key in ("x", "y", "rotation"):
        value_num = obj.get(key)
        if not isinstance(value_num, (int, float)) or abs(value_num) > 100000:
            raise serializers.ValidationError({key: f"{owner_id} {key} is out of range"})


def validate_text_item(obj, owner_id):
    if not isinstance(obj.get("text"), str):
        raise serializers.ValidationError({"text": f"{owner_id} text must be a string"})
    validate_position_fields(obj, owner_id)
    fill = obj.get("fill")
    if not isinstance(fill, str) or not HEX_COLOR_RE.match(fill):
        raise serializers.ValidationError({"fill": f"{owner_id} fill must be a hex color"})
    font_size = obj.get("font_size")
    if not isinstance(font_size, (int, float)) or font_size < 8 or font_size > 240:
        raise serializers.ValidationError({"font_size": f"{owner_id} font_size is out of range"})


def validate_sticker_item(obj, owner_id):
    for key in ("goods_id", "src"):
        if not isinstance(obj.get(key), str) or not obj.get(key):
            raise serializers.ValidationError({key: f"{owner_id} {key} is required"})
    validate_position_fields(obj, owner_id)
    for key in ("width", "height"):
        value_num = obj.get(key)
        if not isinstance(value_num, (int, float)) or value_num <= 0 or value_num > 5000:
            raise serializers.ValidationError({key: f"{owner_id} {key} is out of range"})


def validate_stroke_item(obj, owner_id):
    brush_type = obj.get("brush_type", "pen")
    if brush_type not in BRUSH_TYPES:
        raise serializers.ValidationError({"brush_type": f"unsupported brush type {brush_type}"})
    points = obj.get("points")
    if not isinstance(points, list) or len(points) < 2 or len(points) % 2 != 0:
        raise serializers.ValidationError({"points": f"{owner_id} points must contain coordinate pairs"})
    if len(points) > MAX_DRAW_POINTS:
        raise serializers.ValidationError({"points": f"{owner_id} points cannot exceed {MAX_DRAW_POINTS}"})
    if any(not isinstance(point, (int, float)) or abs(point) > 100000 for point in points):
        raise serializers.ValidationError({"points": f"{owner_id} points must be numeric and in range"})
    stroke = obj.get("stroke")
    if not isinstance(stroke, str) or not HEX_COLOR_RE.match(stroke):
        raise serializers.ValidationError({"stroke": f"{owner_id} stroke must be a hex color"})
    stroke_width = obj.get("stroke_width")
    if not isinstance(stroke_width, (int, float)) or stroke_width <= 0 or stroke_width > 80:
        raise serializers.ValidationError({"stroke_width": f"{owner_id} stroke_width is out of range"})
    validate_opacity(obj.get("opacity"), "opacity", owner_id)


def validate_journal_content_v1(value, layers):
    seen_ids = set()
    for index, layer in enumerate(layers):
        layer_id, layer_type = validate_layer_identity(layer, index, seen_ids)

        if layer_type == "draw":
            validate_stroke_item(
                {
                    "id": layer_id,
                    "type": "stroke",
                    "brush_type": layer.get("brush_type", "pen"),
                    "points": layer.get("points"),
                    "stroke": layer.get("stroke"),
                    "stroke_width": layer.get("stroke_width"),
                    "opacity": layer.get("opacity"),
                },
                f"layer {layer_id}",
            )

        if layer_type == "text":
            validate_text_item(layer, f"layer {layer_id}")

        if layer_type == "sticker":
            validate_sticker_item(layer, f"layer {layer_id}")
            validate_opacity(layer.get("opacity"), "opacity", f"layer {layer_id}")

    return value


def validate_journal_content_v2(value, layers):
    seen_ids = set()
    seen_item_ids = set()
    total_points = 0

    for index, layer in enumerate(layers):
        layer_id, layer_type = validate_layer_identity(layer, index, seen_ids)
        validate_opacity(layer.get("opacity"), "opacity", f"layer {layer_id}")
        items = layer.get("items")
        if not isinstance(items, list):
            raise serializers.ValidationError({"items": f"layer {layer_id} items must be a list"})
        if len(items) > MAX_ITEMS_PER_LAYER:
            raise serializers.ValidationError({"items": f"layer {layer_id} items cannot exceed {MAX_ITEMS_PER_LAYER}"})
        for item_index, item in enumerate(items):
            if not isinstance(item, dict):
                raise serializers.ValidationError({"items": f"layer {layer_id} item {item_index} must be an object"})
            item_id = item.get("id")
            if not isinstance(item_id, str) or not item_id:
                raise serializers.ValidationError({"id": f"layer {layer_id} item {item_index} id is required"})
            if item_id in seen_item_ids:
                raise serializers.ValidationError({"id": f"duplicate item id {item_id}"})
            seen_item_ids.add(item_id)

            item_type = item.get("type")
            owner_id = f"item {item_id}"
            if layer_type == "draw":
                if item_type != "stroke":
                    raise serializers.ValidationError({"type": f"draw layer {layer_id} only supports stroke items"})
                validate_stroke_item(item, owner_id)
                total_points += len(item.get("points", []))
                if total_points > MAX_DRAW_POINTS:
                    raise serializers.ValidationError({"points": f"total draw points cannot exceed {MAX_DRAW_POINTS}"})
                continue
            if layer_type == "sticker":
                if item_type != "sticker":
                    raise serializers.ValidationError({"type": f"sticker layer {layer_id} only supports sticker items"})
                validate_sticker_item(item, owner_id)
                continue
            if item_type != "text":
                raise serializers.ValidationError({"type": f"text layer {layer_id} only supports text items"})
            validate_text_item(item, owner_id)

    return value


class JournalPageSerializer(serializers.ModelSerializer):
    create_version = serializers.BooleanField(write_only=True, required=False, default=True)

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
            "revision",
            "create_version",
            "preview_image",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "book", "page_no", "created_at", "updated_at")

    def validate_content(self, value):
        return validate_journal_content(value)

    def validate_revision(self, value):
        if self.instance is not None and value != self.instance.revision:
            raise serializers.ValidationError("revision conflict", code="journal_revision_conflict")
        return value

    def create(self, validated_data):
        validated_data.pop("create_version", None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("create_version", None)
        if "content" in validated_data or any(key in validated_data for key in ("title", "width", "height", "background")):
            validated_data["revision"] = instance.revision + 1
        return super().update(instance, validated_data)


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


class JournalPageVersionSummarySerializer(serializers.ModelSerializer):
    summary = serializers.SerializerMethodField()

    class Meta:
        model = JournalPageVersion
        fields = (
            "id",
            "page",
            "version_no",
            "preview_image",
            "summary",
            "created_at",
        )
        read_only_fields = fields

    def get_summary(self, obj):
        content = obj.content or {}
        layers = content.get("layers") if isinstance(content, dict) else []
        if not isinstance(layers, list):
            layers = []
        return {"layer_count": len(layers)}


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
