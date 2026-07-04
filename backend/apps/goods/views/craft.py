from rest_framework import filters as drf_filters, mixins, viewsets
from rest_framework.permissions import IsAuthenticated

from ..models import GoodsCraft
from ..serializers import GoodsCraftSerializer


class GoodsCraftViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Active craft options for authenticated frontend users."""

    serializer_class = GoodsCraftSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = (drf_filters.SearchFilter,)
    search_fields = ("name",)

    def get_queryset(self):
        return GoodsCraft.objects.filter(is_active=True).order_by("order", "id")
