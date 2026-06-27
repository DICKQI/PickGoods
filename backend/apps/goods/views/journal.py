from django.db import transaction
from django.db.models import Count, Max, Min
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from core.permissions import IsOwnerOnly, is_admin
from ..models import JournalBook, JournalPage, JournalPageVersion
from ..serializers.journal import (
    JournalBookDetailSerializer,
    JournalBookListSerializer,
    JournalPageSerializer,
    JournalPageVersionSerializer,
)
from ..utils import compress_image


class JournalBookPagination(PageNumberPagination):
    page_size = 20
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


class JournalPageVersionPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 50

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


def create_page_version(page):
    next_version_no = (
        JournalPageVersion.objects.filter(page=page)
        .aggregate(max_version=Max("version_no"))
        .get("max_version")
        or 0
    ) + 1
    version = JournalPageVersion.objects.create(
        page=page,
        version_no=next_version_no,
        content=page.content,
        preview_image=page.preview_image,
    )
    stale_ids = list(
        JournalPageVersion.objects.filter(page=page)
        .order_by("-version_no")
        .values_list("id", flat=True)[50:]
    )
    if stale_ids:
        JournalPageVersion.objects.filter(id__in=stale_ids).delete()
    return version


class JournalBookViewSet(viewsets.ModelViewSet):
    queryset = JournalBook.objects.all().prefetch_related("pages")
    permission_classes = [IsOwnerOnly]
    pagination_class = JournalBookPagination
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    ORDER_STEP = 1000

    def get_serializer_class(self):
        if self.action == "list":
            return JournalBookListSerializer
        return JournalBookDetailSerializer

    def get_queryset(self):
        qs = (
            JournalBook.objects.all()
            .annotate(page_count=Count("pages"))
            .prefetch_related("pages")
            .order_by("order", "-updated_at")
        )
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "id", None):
            return qs.none()
        if is_admin(user):
            return qs
        return qs.filter(user=user)

    def perform_create(self, serializer):
        user = self.request.user
        min_order = (
            JournalBook.objects.filter(user=user)
            .aggregate(min_order=Min("order"))
            .get("min_order")
        )
        next_order = (min_order or 0) - self.ORDER_STEP
        with transaction.atomic():
            book = serializer.save(user=user, order=next_order)
            page = JournalPage.objects.create(book=book)
            create_page_version(page)

    @action(detail=True, methods=["get", "post"], url_path="pages")
    def pages(self, request, pk=None):
        book = self.get_object()
        if request.method == "GET":
            pages = book.pages.all()
            serializer = JournalPageSerializer(pages, many=True, context=self.get_serializer_context())
            return Response(serializer.data)

        serializer = JournalPageSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        last_page = book.pages.order_by("-page_no").first()
        page_no = (last_page.page_no if last_page else 0) + 1
        page = serializer.save(book=book, page_no=page_no, title=f"? {page_no} ?")
        create_page_version(page)
        return Response(
            JournalPageSerializer(page, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )


class JournalPageViewSet(viewsets.ModelViewSet):
    queryset = JournalPage.objects.select_related("book", "book__user")
    serializer_class = JournalPageSerializer
    permission_classes = [IsOwnerOnly]
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        qs = JournalPage.objects.select_related("book", "book__user")
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "id", None):
            return qs.none()
        if is_admin(user):
            return qs
        return qs.filter(book__user=user)

    def get_permissions(self):
        # IsOwnerOnly expects user_id on the object. JournalPage owns through book.
        return super().get_permissions()

    def check_object_permissions(self, request, obj):
        if is_admin(request.user):
            return
        if getattr(obj.book, "user_id", None) != getattr(request.user, "id", None):
            self.permission_denied(request)

    def perform_update(self, serializer):
        with transaction.atomic():
            page = serializer.save()
            create_page_version(page)

    @action(detail=True, methods=["get"], url_path="versions")
    def versions(self, request, pk=None):
        page = self.get_object()
        paginator = JournalPageVersionPagination()
        paginated = paginator.paginate_queryset(page.versions.all(), request, view=self)
        serializer = JournalPageVersionSerializer(paginated, many=True, context=self.get_serializer_context())
        return paginator.get_paginated_response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="upload-preview",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_preview(self, request, pk=None):
        page = self.get_object()
        preview_image = request.FILES.get("preview_image")
        if not preview_image:
            return Response(
                {"detail": "??? form-data ?? preview_image ??"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        compressed = compress_image(preview_image, max_size_kb=500)
        page.preview_image = compressed or preview_image
        page.save(update_fields=["preview_image", "updated_at"])
        serializer = self.get_serializer(page)
        return Response(serializer.data, status=status.HTTP_200_OK)


class JournalPageVersionViewSet(viewsets.ModelViewSet):
    queryset = JournalPageVersion.objects.select_related("page", "page__book", "page__book__user")
    serializer_class = JournalPageVersionSerializer
    permission_classes = [IsOwnerOnly]
    http_method_names = ["get", "delete", "post", "head", "options"]

    def get_queryset(self):
        qs = JournalPageVersion.objects.select_related("page", "page__book", "page__book__user")
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "id", None):
            return qs.none()
        if is_admin(user):
            return qs
        return qs.filter(page__book__user=user)

    def check_object_permissions(self, request, obj):
        if is_admin(request.user):
            return
        if getattr(obj.page.book, "user_id", None) != getattr(request.user, "id", None):
            self.permission_denied(request)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        version = self.get_object()
        with transaction.atomic():
            page = version.page
            page.content = version.content
            if version.preview_image:
                page.preview_image = version.preview_image
                page.save(update_fields=["content", "preview_image", "updated_at"])
            else:
                page.save(update_fields=["content", "updated_at"])
            create_page_version(page)
        return Response(
            JournalPageSerializer(page, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )
