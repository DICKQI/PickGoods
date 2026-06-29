from copy import deepcopy
import re
import secrets

from django.db import transaction
from django.db.models import Count, Max, Min
from django.urls import reverse
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from core.permissions import IsOwnerOnly, is_admin
from ..models import JournalBook, JournalPage, JournalPageVersion
from ..serializers.journal import (
    JournalBookDetailSerializer,
    JournalBookListSerializer,
    JournalPageSerializer,
    JournalPageSummarySerializer,
    JournalPageVersionSerializer,
    JournalPageVersionSummarySerializer,
)
from ..utils import compress_image

DEFAULT_PAGE_TITLE_RE = re.compile(r"^第 \d+ 页$")


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
            serializer_class = (
                JournalPageSummarySerializer
                if request.query_params.get("fields") == "summary"
                else JournalPageSerializer
            )
            serializer = serializer_class(pages, many=True, context=self.get_serializer_context())
            return Response(serializer.data)

        serializer = JournalPageSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        last_page = book.pages.order_by("-page_no").first()
        page_no = (last_page.page_no if last_page else 0) + 1
        page = serializer.save(book=book, page_no=page_no, title=f"第 {page_no} 页")
        create_page_version(page)
        return Response(
            JournalPageSerializer(page, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="pages/reorder")
    def reorder_pages(self, request, pk=None):
        book = self.get_object()
        page_ids = request.data.get("page_ids")
        if not isinstance(page_ids, list) or not page_ids or any(not isinstance(item, str) for item in page_ids):
            return Response({"page_ids": "page_ids must be a non-empty list of ids"}, status=status.HTTP_400_BAD_REQUEST)

        pages = list(book.pages.all())
        pages_by_id = {str(page.id): page for page in pages}
        if set(page_ids) != set(pages_by_id):
            return Response({"page_ids": "page_ids must include every page in this journal"}, status=status.HTTP_400_BAD_REQUEST)

        ordered_pages = [pages_by_id[page_id] for page_id in page_ids]
        with transaction.atomic():
            for index, page in enumerate(ordered_pages, start=1):
                page.page_no = 100000 + index
                page.save(update_fields=["page_no", "updated_at"])
            for index, page in enumerate(ordered_pages, start=1):
                page.page_no = index
                if DEFAULT_PAGE_TITLE_RE.match(page.title or ""):
                    page.title = f"第 {index} 页"
                    page.save(update_fields=["page_no", "title", "updated_at"])
                else:
                    page.save(update_fields=["page_no", "updated_at"])

        serializer = JournalPageSerializer(ordered_pages, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="upload-cover",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_cover(self, request, pk=None):
        book = self.get_object()
        cover_image = request.FILES.get("cover_image")
        if not cover_image:
            return Response(
                {"detail": "请通过 form-data 提供 cover_image 文件"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        compressed = compress_image(cover_image, max_size_kb=300)
        book.cover_image = compressed or cover_image
        book.save(update_fields=["cover_image", "updated_at"])
        serializer = self.get_serializer(book)
        return Response(serializer.data, status=status.HTTP_200_OK)


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

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        try:
            serializer.is_valid(raise_exception=True)
        except serializers.ValidationError as exc:
            if self._is_revision_conflict(exc):
                return Response(
                    {
                        "detail": "页面已被更新，请刷新后重试",
                        "code": "journal_revision_conflict",
                        "current_revision": instance.revision,
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            raise
        self.perform_update(serializer)
        return Response(serializer.data)

    def _is_revision_conflict(self, exc):
        detail = getattr(exc, "detail", {})
        revision_errors = detail.get("revision") if isinstance(detail, dict) else None
        if not revision_errors:
            return False
        errors = revision_errors if isinstance(revision_errors, list) else [revision_errors]
        return any(getattr(error, "code", None) == "journal_revision_conflict" for error in errors)

    def perform_update(self, serializer):
        create_version_requested = serializer.validated_data.get("create_version", True)
        with transaction.atomic():
            page = serializer.save()
            if create_version_requested:
                create_page_version(page)

    @action(detail=True, methods=["get"], url_path="versions")
    def versions(self, request, pk=None):
        page = self.get_object()
        paginator = JournalPageVersionPagination()
        paginated = paginator.paginate_queryset(page.versions.all(), request, view=self)
        serializer = JournalPageVersionSummarySerializer(paginated, many=True, context=self.get_serializer_context())
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
                {"detail": "请通过 form-data 提供 preview_image 文件"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        compressed = compress_image(preview_image, max_size_kb=500)
        page.preview_image = compressed or preview_image
        page.save(update_fields=["preview_image", "updated_at"])
        serializer = self.get_serializer(page)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        page = self.get_object()
        book = page.book
        last_page = book.pages.order_by("-page_no").first()
        page_no = (last_page.page_no if last_page else 0) + 1
        with transaction.atomic():
            duplicated = JournalPage.objects.create(
                book=book,
                title=f"第 {page_no} 页",
                page_no=page_no,
                width=page.width,
                height=page.height,
                background=page.background,
                background_style=page.background_style,
                content=deepcopy(page.content),
            )
            create_page_version(duplicated)
        serializer = self.get_serializer(duplicated)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, pk=None):
        page = self.get_object()
        if not page.share_token:
            token = secrets.token_urlsafe(32)
            while JournalPage.objects.filter(share_token=token).exists():
                token = secrets.token_urlsafe(32)
            page.share_token = token
            page.save(update_fields=["share_token", "updated_at"])
        public_path = reverse("journal-public-page", kwargs={"token": page.share_token})
        return Response(
            {
                "token": page.share_token,
                "url": request.build_absolute_uri(public_path),
            },
            status=status.HTTP_200_OK,
        )


class PublicJournalPageViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = JournalPage.objects.select_related("book", "book__user")
    serializer_class = JournalPageSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "journal_public"
    lookup_field = "share_token"
    lookup_url_kwarg = "token"
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        return super().get_queryset().filter(share_token__isnull=False).exclude(share_token="")


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
            page.revision += 1
            if version.preview_image:
                page.preview_image = version.preview_image
                page.save(update_fields=["content", "revision", "preview_image", "updated_at"])
            else:
                page.save(update_fields=["content", "revision", "updated_at"])
            create_page_version(page)
        return Response(
            JournalPageSerializer(page, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )
