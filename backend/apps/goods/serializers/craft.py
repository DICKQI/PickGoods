from rest_framework import serializers

from ..models import GoodsCraft


class GoodsCraftSerializer(serializers.ModelSerializer):
    """Read-only craft option used by the goods form."""

    class Meta:
        model = GoodsCraft
        fields = ("id", "name", "order", "is_active")
        read_only_fields = fields
