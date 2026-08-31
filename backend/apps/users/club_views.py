from __future__ import annotations

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import BooleanField, Count, Exists, IntegerField, Min, OuterRef, Prefetch, Q, Subquery, UUIDField, Value
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.goods.models import (
    Character,
    ClubCatalogItem,
    ClubCatalogImage,
    ClubGoodsImportEvent,
    ClubGoodsOrigin,
    Goods,
    GuziImage,
    IP,
    Theme,
    ThemeImage,
    ThemeTemplate,
)
from apps.goods.serializers.goods import GoodsDetailSerializer
from apps.goods.utils import compress_image
from core.permissions import IsClubAccount, IsCollectorAccount, is_admin

from .club_serializers import (
    ClubAvatarUploadSerializer,
    ClubCatalogBatchRequestSerializer,
    ClubCatalogReorderSerializer,
    ClubCatalogImageSerializer,
    ClubCatalogItemSerializer,
    ClubCatalogPublicSerializer,
    ClubDirectorySerializer,
    ClubImportSerializer,
    ClubImportTemplateSerializer,
    ClubFavoriteSerializer,
    ClubPopularitySerializer,
    ClubPopularityResponseSerializer,
    ClubPublicDetailSerializer,
    ClubSerializer,
)
from .models import Club, ClubFavorite, User


class ClubPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            "count": self.page.paginator.count,
            "page": self.page.number,
            "page_size": self.page.paginator.per_page,
            "next": self.page.next_page_number() if self.page.has_next() else None,
            "previous": self.page.previous_page_number() if self.page.has_previous() else None,
            "results": data,
        })


CLUB_DIRECTORY_PREVIEW_LIMIT = 5


def _public_club_queryset():
    return Club.objects.select_related("user").filter(
        user__account_type=User.ACCOUNT_TYPE_CLUB,
        user__approval_status=User.APPROVAL_APPROVED,
        user__is_active=True,
    ).order_by("name", "id")


def _copy_theme_for_user(source_theme: Theme, user):
    """主题是用户私有数据，导入时按名称复用或复制。"""
    theme = Theme.objects.filter(user=user, name=source_theme.name).first()
    if theme:
        return theme
    theme = Theme.objects.create(user=user, name=source_theme.name, description=source_theme.description)
    for image in source_theme.images.all():
        image.image.open("rb")
        copied = ThemeImage(theme=theme, label=image.label)
        copied.image.save(image.image.name.rsplit("/", 1)[-1], ContentFile(image.image.read()), save=True)
    source_template = getattr(source_theme, "template", None)
    if source_template:
        template = ThemeTemplate.objects.create(
            theme=theme, user=user, name=source_template.name, ip=source_template.ip,
            purchase_date=source_template.purchase_date, is_official=source_template.is_official,
            notes=source_template.notes,
        )
        template.characters.set(source_template.characters.all())
    return theme


def _copy_catalog_media(source: ClubCatalogItem, target: Goods):
    if source.main_photo and source.main_photo.name:
        source.main_photo.open("rb")
        target.main_photo.save(
            f"club_{source.id}_{source.main_photo.name.rsplit('/', 1)[-1]}",
            ContentFile(source.main_photo.read()),
            save=True,
        )
    for photo in source.additional_photos.all():
        photo.image.open("rb")
        copied = GuziImage(guzi=target, label=photo.label)
        copied.image.save(photo.image.name.rsplit("/", 1)[-1], ContentFile(photo.image.read()), save=True)


def _catalog_snapshot(item: ClubCatalogItem) -> dict:
    return {
        "id": str(item.id),
        "club_id": item.club_id,
        "club_name": item.club.name,
        "name": item.name,
        "description": item.description,
        "ip": {"id": item.ip_id, "name": item.ip.name},
        "category": {"id": item.category_id, "name": item.category.name},
        "theme": {"id": item.theme_id, "name": item.theme.name} if item.theme else None,
        "characters": [
            {"id": character.id, "name": character.name}
            for character in item.characters.all()
        ],
        "public_price": str(item.public_price) if item.public_price is not None else None,
        "is_official": item.is_official,
        "publication_status": item.publication_status,
        "main_photo": item.main_photo.name if item.main_photo else None,
        "additional_photos": [
            {"id": photo.id, "name": photo.image.name, "label": photo.label}
            for photo in item.additional_photos.all()
        ],
        "captured_at": timezone.now().isoformat(),
    }


class ClubViewSet(viewsets.GenericViewSet):
    queryset = _public_club_queryset()
    pagination_class = ClubPagination
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_permissions(self):
        if self.action in ("list", "retrieve", "goods"):
            return [AllowAny()]
        if self.action in ("me", "avatar", "popularity"):
            return [IsAuthenticated(), IsClubAccount()]
        if self.action in ("favorite", "favorites"):
            return [IsAuthenticated(), IsCollectorAccount()]
        return [IsAuthenticated()]

    def list(self, request):
        queryset = self.get_queryset().annotate(
            listed_goods_count=Count(
                "catalog_items",
                filter=Q(catalog_items__publication_status=ClubCatalogItem.PUBLICATION_LISTED),
                distinct=True,
            )
        )
        keyword = (request.query_params.get("search") or "").strip()
        if keyword:
            queryset = queryset.filter(Q(name__icontains=keyword) | Q(description__icontains=keyword))
        page = self.paginate_queryset(queryset)
        page_clubs = list(page or [])
        preview_by_club = {}
        club_ids = [club.id for club in page_clubs]
        if club_ids:
            preview_queryset = ClubCatalogItem.objects.filter(
                club_id__in=club_ids,
                publication_status=ClubCatalogItem.PUBLICATION_LISTED,
            ).prefetch_related(
                Prefetch(
                    "additional_photos",
                    queryset=ClubCatalogImage.objects.order_by("id"),
                    to_attr="directory_additional_photos",
                )
            ).order_by("club_id", "-created_at", "-updated_at", "id")
            for item in preview_queryset:
                items = preview_by_club.setdefault(item.club_id, [])
                if len(items) < CLUB_DIRECTORY_PREVIEW_LIMIT:
                    items.append(item)
        for club in page_clubs:
            club.directory_preview_goods = preview_by_club.get(club.id, [])
        serializer = ClubDirectorySerializer(page_clubs, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)

    def retrieve(self, request, pk=None):
        club = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(ClubPublicDetailSerializer(club, context={"request": request}).data)

    @action(detail=True, methods=["put", "delete"], url_path="favorite")
    def favorite(self, request, pk=None):
        club = get_object_or_404(self.get_queryset(), pk=pk)
        if request.method.lower() == "put":
            _, created = ClubFavorite.objects.get_or_create(user=request.user, club=club)
            payload = ClubPublicDetailSerializer(club, context={"request": request}).data
            return Response(payload, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        ClubFavorite.objects.filter(user=request.user, club=club).delete()
        return Response(ClubPublicDetailSerializer(club, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="me/favorites")
    def favorites(self, request):
        queryset = ClubFavorite.objects.filter(
            user=request.user,
            club__user__account_type=User.ACCOUNT_TYPE_CLUB,
            club__user__approval_status=User.APPROVAL_APPROVED,
            club__user__is_active=True,
        ).select_related("club", "club__user").order_by("-created_at", "-id")
        page = self.paginate_queryset(queryset)
        serializer = ClubFavoriteSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        club = get_object_or_404(Club, user=request.user)
        if request.method.lower() == "patch":
            serializer = ClubSerializer(club, data=request.data, partial=True, context={"request": request})
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(ClubSerializer(club, context={"request": request}).data)

    @action(detail=False, methods=["post"], url_path="me/avatar", parser_classes=[MultiPartParser, FormParser])
    def avatar(self, request):
        club = get_object_or_404(Club, user=request.user)
        serializer = ClubAvatarUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        image = serializer.validated_data["avatar"]
        compressed = compress_image(image, max_size_kb=300)
        club.avatar = compressed or image
        club.save(update_fields=["avatar", "updated_at"])
        return Response(ClubSerializer(club, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="goods")
    def goods(self, request, pk=None):
        club = get_object_or_404(self.get_queryset(), pk=pk)
        public_ip_queryset = IP.objects.annotate(
            character_count=Count("characters", distinct=True),
        ).prefetch_related("keywords")
        public_character_queryset = Character.objects.prefetch_related(
            Prefetch("ip", queryset=public_ip_queryset),
        )
        queryset = ClubCatalogItem.objects.filter(
            club=club,
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        ).select_related("club", "category", "theme").prefetch_related(
            Prefetch("ip", queryset=public_ip_queryset),
            Prefetch("characters", queryset=public_character_queryset),
            "additional_photos",
        )
        if request.user.is_authenticated and (
            getattr(request.user, "account_type", None) == User.ACCOUNT_TYPE_COLLECTOR
            or is_admin(request.user)
        ):
            import_origin_queryset = ClubGoodsOrigin.objects.filter(
                collector=request.user,
                source_item=OuterRef("pk"),
                personal_goods__isnull=False,
            )
            queryset = queryset.annotate(
                collector_imported=Exists(import_origin_queryset),
                collector_imported_quantity=Subquery(
                    import_origin_queryset.values("personal_goods__quantity")[:1]
                ),
                collector_imported_goods_id=Subquery(
                    import_origin_queryset.values("personal_goods_id")[:1]
                ),
            )
        else:
            queryset = queryset.annotate(
                collector_imported=Value(False, output_field=BooleanField()),
                collector_imported_quantity=Value(None, output_field=IntegerField()),
                collector_imported_goods_id=Value(None, output_field=UUIDField()),
            )
        imported_filter = (request.query_params.get("imported") or "").strip().lower()
        if imported_filter == "imported":
            queryset = queryset.filter(collector_imported=True)
        elif imported_filter == "unimported":
            queryset = queryset.filter(collector_imported=False)
        keyword = (request.query_params.get("search") or "").strip()
        if keyword:
            queryset = queryset.filter(
                Q(name__icontains=keyword)
                | Q(ip__name__icontains=keyword)
                | Q(category__name__icontains=keyword)
            ).distinct()
        page = self.paginate_queryset(queryset)
        serializer = ClubCatalogPublicSerializer(page, many=True, context={"request": request})
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=["get"], url_path="me/popularity")
    def popularity(self, request):
        club = get_object_or_404(Club, user=request.user)
        queryset = ClubCatalogItem.objects.filter(club=club).annotate(
            intended_user_count=Count(
                "goods_origins__collector",
                filter=(
                    Q(goods_origins__collector__account_type=User.ACCOUNT_TYPE_COLLECTOR)
                    & ~Q(goods_origins__collector__role__name__iexact="Admin")
                    & Q(goods_origins__personal_goods__status="intended")
                ),
                distinct=True,
            ),
            acquired_user_count=Count(
                "goods_origins__collector",
                filter=(
                    Q(goods_origins__collector__account_type=User.ACCOUNT_TYPE_COLLECTOR)
                    & ~Q(goods_origins__collector__role__name__iexact="Admin")
                    & Q(goods_origins__personal_goods__status__in=("in_cabinet", "outdoor", "sold"))
                ),
                distinct=True,
            ),
        )
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter in {choice[0] for choice in ClubCatalogItem.PUBLICATION_STATUS_CHOICES}:
            queryset = queryset.filter(publication_status=status_filter)
        keyword = (request.query_params.get("search") or "").strip()
        if keyword:
            queryset = queryset.filter(
                Q(name__icontains=keyword)
                | Q(ip__name__icontains=keyword)
                | Q(category__name__icontains=keyword)
            ).distinct()
        sort = request.query_params.get("sort", "order")
        sort_map = {
            "order": ("order", "-created_at"),
            "name": ("name", "id"),
            "intended": ("-intended_user_count", "order", "-created_at"),
            "acquired": ("-acquired_user_count", "order", "-created_at"),
        }
        queryset = queryset.order_by(*sort_map.get(sort, sort_map["order"]))
        items = list(queryset)
        data = ClubPopularitySerializer([
            {
                "goods_id": item.id,
                "goods_name": item.name,
                "intended_user_count": item.intended_user_count,
                "acquired_user_count": item.acquired_user_count,
            }
            for item in items
        ], many=True).data
        summary = {
            "total": len(items),
            "listed": sum(item.publication_status == ClubCatalogItem.PUBLICATION_LISTED for item in items),
            "draft": sum(item.publication_status == ClubCatalogItem.PUBLICATION_DRAFT for item in items),
            "unlisted": sum(item.publication_status == ClubCatalogItem.PUBLICATION_UNLISTED for item in items),
            "intended_user_count": sum(item.intended_user_count for item in items),
            "acquired_user_count": sum(item.acquired_user_count for item in items),
        }
        # Keep the response explicit for API clients while exposing status on each row.
        for payload, item in zip(data, items):
            payload["publication_status"] = item.publication_status
        return Response(ClubPopularityResponseSerializer({"items": data, "summary": summary}).data)


class ClubCatalogManagementViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsClubAccount]
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    pagination_class = ClubPagination
    serializer_class = ClubCatalogItemSerializer

    def _club(self):
        return get_object_or_404(Club, user=self.request.user)

    def get_queryset(self):
        return ClubCatalogItem.objects.filter(club__user=self.request.user).select_related(
            "club", "ip", "category", "theme"
        ).prefetch_related("characters__ip", "additional_photos")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["club"] = self._club()
        return context

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        keyword = (request.query_params.get("search") or "").strip()
        if keyword:
            queryset = queryset.filter(
                Q(name__icontains=keyword)
                | Q(ip__name__icontains=keyword)
                | Q(category__name__icontains=keyword)
            ).distinct()
        summary = {
            "total": queryset.count(),
            "listed": queryset.filter(publication_status=ClubCatalogItem.PUBLICATION_LISTED).count(),
            "draft": queryset.filter(publication_status=ClubCatalogItem.PUBLICATION_DRAFT).count(),
            "unlisted": queryset.filter(publication_status=ClubCatalogItem.PUBLICATION_UNLISTED).count(),
        }
        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter in {choice[0] for choice in ClubCatalogItem.PUBLICATION_STATUS_CHOICES}:
            queryset = queryset.filter(publication_status=status_filter)
        sort = request.query_params.get("sort", "order")
        sort_map = {
            "order": ("order", "-created_at"),
            "name": ("name", "id"),
            "created": ("-created_at", "id"),
        }
        queryset = queryset.order_by(*sort_map.get(sort, sort_map["order"]))
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        response = self.get_paginated_response(serializer.data)
        response.data["summary"] = summary
        return response

    def perform_create(self, serializer):
        club = self._club()
        min_order = ClubCatalogItem.objects.filter(club=club).aggregate(min_order=Min("order"))["min_order"]
        serializer.save(club=club, order=(min_order or 0) - 1000)

    def _validate_batch_items(self, request, allowed_statuses, operation_label):
        serializer = ClubCatalogBatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        goods_ids = serializer.validated_data["goods_ids"]
        items = list(
            self.get_queryset()
            .select_for_update()
            .filter(id__in=goods_ids)
        )
        item_by_id = {item.id: item for item in items}
        invalid_ids = [str(goods_id) for goods_id in goods_ids if goods_id not in item_by_id]
        invalid_ids.extend(
            str(goods_id)
            for goods_id in goods_ids
            if goods_id in item_by_id and item_by_id[goods_id].publication_status not in allowed_statuses
        )
        if invalid_ids:
            return None, Response(
                {
                    "code": "club_goods_batch_invalid",
                    "detail": f"所选谷子中包含不存在、非本社团或不符合{operation_label}要求的条目",
                    "invalid_ids": invalid_ids,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return items, None

    @action(detail=False, methods=["post"], url_path="batch-delete")
    def batch_delete(self, request):
        with transaction.atomic():
            items, error = self._validate_batch_items(
                request,
                {
                    ClubCatalogItem.PUBLICATION_DRAFT,
                    ClubCatalogItem.PUBLICATION_UNLISTED,
                },
                "批量删除",
            )
            if error is not None:
                return error
            deleted_ids = [str(item.id) for item in items]
            ClubCatalogItem.objects.filter(id__in=[item.id for item in items]).delete()
        return Response({"deleted_count": len(deleted_ids), "deleted_ids": deleted_ids})

    @action(detail=False, methods=["post"], url_path="batch-unlist")
    def batch_unlist(self, request):
        with transaction.atomic():
            items, error = self._validate_batch_items(
                request,
                {ClubCatalogItem.PUBLICATION_LISTED},
                "批量下架",
            )
            if error is not None:
                return error
            updated_ids = [str(item.id) for item in items]
            now = timezone.now()
            for item in items:
                item.publication_status = ClubCatalogItem.PUBLICATION_UNLISTED
                item.publish_at = None
                item.publish_failed_at = None
                item.publish_error = None
                item.updated_at = now
            ClubCatalogItem.objects.bulk_update(
                items, ["publication_status", "publish_at", "publish_failed_at", "publish_error", "updated_at"]
            )
        return Response({"updated_count": len(updated_ids), "updated_ids": updated_ids})

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        serializer = ClubCatalogReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        goods_ids = serializer.validated_data["goods_ids"]
        with transaction.atomic():
            items = list(self.get_queryset().select_for_update().filter(id__in=goods_ids))
            item_by_id = {item.id: item for item in items}
            if len(items) != len(goods_ids):
                invalid_ids = [str(goods_id) for goods_id in goods_ids if goods_id not in item_by_id]
                return Response({"detail": "排序列表包含不存在或不属于本社团的谷子", "invalid_ids": invalid_ids}, status=status.HTTP_400_BAD_REQUEST)
            now = timezone.now()
            for index, goods_id in enumerate(goods_ids):
                item_by_id[goods_id].order = index * 1000
                item_by_id[goods_id].updated_at = now
            ClubCatalogItem.objects.bulk_update(items, ["order", "updated_at"])
        return Response({"updated_count": len(goods_ids), "goods_ids": [str(goods_id) for goods_id in goods_ids]})

    @action(detail=True, methods=["post"], url_path="upload-main-photo", parser_classes=[MultiPartParser, FormParser])
    def upload_main_photo(self, request, pk=None):
        item = self.get_object()
        image = request.FILES.get("main_photo")
        if not image:
            return Response({"detail": "请提供 main_photo 文件"}, status=status.HTTP_400_BAD_REQUEST)
        compressed = compress_image(image, max_size_kb=300)
        item.main_photo = compressed or image
        item.save(update_fields=["main_photo", "updated_at"])
        return Response(self.get_serializer(item).data)

    @action(detail=True, methods=["post"], url_path="upload-additional-photos", parser_classes=[MultiPartParser, FormParser])
    def upload_additional_photos(self, request, pk=None):
        item = self.get_object()
        files = request.FILES.getlist("additional_photos")
        if not files:
            return Response({"detail": "请至少提供一张 additional_photos 图片"}, status=status.HTTP_400_BAD_REQUEST)
        label = request.data.get("label") or None
        for image in files:
            compressed = compress_image(image, max_size_kb=300)
            photo = ClubCatalogImage.objects.create(item=item, label=label)
            photo.image.save(image.name, compressed or image, save=True)
        return Response(self.get_serializer(item).data)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"additional-photos/(?P<photo_id>\d+)",
    )
    def delete_additional_photo(self, request, pk=None, photo_id=None):
        item = self.get_object()
        photo = get_object_or_404(ClubCatalogImage, pk=photo_id, item=item)
        photo.delete()
        return Response(self.get_serializer(item).data)


class ClubGoodsImportTemplateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, goods_id):
        if getattr(request.user, "account_type", None) != User.ACCOUNT_TYPE_COLLECTOR and not is_admin(request.user):
            return Response({"detail": "只有吃谷人可以导入社团谷子"}, status=status.HTTP_403_FORBIDDEN)
        club = get_object_or_404(_public_club_queryset(), pk=pk)
        source = get_object_or_404(
            ClubCatalogItem.objects.select_related("club", "ip", "category", "theme").prefetch_related(
                "characters__ip", "additional_photos"
            ),
            pk=goods_id,
            club=club,
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        )
        existing_origin = ClubGoodsOrigin.objects.filter(
            collector=request.user, source_item=source
        ).select_related("personal_goods").first()
        existing_goods = existing_origin.personal_goods if existing_origin else None
        payload = {
            "source_item_id": source.id,
            "source": source,
            "defaults": {
                "name": source.name,
                "ip_id": source.ip_id,
                "category_id": source.category_id,
                "character_ids": list(source.characters.values_list("id", flat=True)),
                # Theme rows are private to their owner; expose a name for the
                # collector-side personal theme rather than an unusable club id.
                "theme_id": None,
                "theme_name": source.theme.name if source.theme else None,
                "price": str(source.public_price) if source.public_price is not None else None,
                "purchase_date": None,
                "notes": "",
                "quantity": 1,
                "is_official": False,
                "status": "intended",
            },
            "existing": {
                "goods_id": str(existing_goods.id),
                "quantity": existing_goods.quantity,
            } if existing_goods else None,
        }
        return Response(ClubImportTemplateSerializer(payload, context={"request": request}).data)


class ClubGoodsImportView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def import_goods(self, request, goods_id=None):
        serializer = ClubImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_user = request.user
        if getattr(target_user, "account_type", None) != User.ACCOUNT_TYPE_COLLECTOR and not is_admin(target_user):
            return Response({"detail": "只有吃谷人可以导入社团谷子"}, status=status.HTTP_403_FORBIDDEN)
        source = get_object_or_404(
            ClubCatalogItem.objects.select_related("club", "ip", "category", "theme").prefetch_related(
                "characters", "additional_photos", "theme__images", "theme__template__characters"
            ),
            pk=goods_id,
            club__user__account_type=User.ACCOUNT_TYPE_CLUB,
            club__user__approval_status=User.APPROVAL_APPROVED,
            club__user__is_active=True,
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        )
        values = serializer.validated_data
        existing_origin = ClubGoodsOrigin.objects.filter(
            collector=target_user, source_item=source
        ).select_related("personal_goods").first()
        existing = existing_origin.personal_goods if existing_origin else None
        if existing and not values["confirm_duplicate"]:
            return Response(
                {
                    "code": "club_goods_already_imported",
                    "detail": "谷仓内已有同一社团的同一个，是否增加数量",
                    "goods": GoodsDetailSerializer(existing, context={"request": request}).data,
                },
                status=status.HTTP_409_CONFLICT,
            )

        with transaction.atomic():
            snapshot = _catalog_snapshot(source)
            if existing:
                existing.quantity += 1
                existing.save(update_fields=["quantity", "updated_at"])
                existing_origin.updated_at = timezone.now()
                existing_origin.save(update_fields=["updated_at"])
                ClubGoodsImportEvent.objects.create(
                    origin=existing_origin,
                    operation=ClubGoodsImportEvent.OPERATION_MERGED,
                    quantity_added=1,
                    source_snapshot=snapshot,
                    goods_snapshot=GoodsDetailSerializer(existing, context={"request": request}).data,
                )
                result = existing
                response_status = status.HTTP_200_OK
                merged = True
            else:
                theme_was_provided = "theme_id" in values
                theme = values.get("theme_id")
                if not theme_was_provided and source.theme_id:
                    theme = _copy_theme_for_user(source.theme, target_user)
                elif theme is not None and theme.user_id != target_user.id and not is_admin(target_user):
                    return Response({"detail": "主题不属于当前用户"}, status=status.HTTP_400_BAD_REQUEST)
                result = Goods.objects.create(
                    user=target_user,
                    name=values.get("name", source.name),
                    ip=values.get("ip_id", source.ip),
                    category=values.get("category_id", source.category),
                    theme=theme,
                    quantity=values.get("quantity", 1),
                    price=values.get("price", source.public_price),
                    purchase_date=values.get("purchase_date"),
                    is_official=False,
                    status=values["status"],
                    notes=values.get("notes") or "",
                    order=(Goods.objects.filter(user=target_user).aggregate(min_order=Min("order"))["min_order"] or 0) - 1000,
                )
                result.characters.set(values.get("character_ids") or source.characters.all())
                _copy_catalog_media(source, result)
                origin = existing_origin or ClubGoodsOrigin.objects.create(
                    collector=target_user,
                    source_item=source,
                    personal_goods=result,
                    first_source_snapshot=snapshot,
                )
                if origin.personal_goods_id != result.id:
                    origin.personal_goods = result
                    origin.save(update_fields=["personal_goods", "updated_at"])
                ClubGoodsImportEvent.objects.create(
                    origin=origin,
                    operation=ClubGoodsImportEvent.OPERATION_CREATED,
                    quantity_added=1,
                    source_snapshot=snapshot,
                    goods_snapshot=GoodsDetailSerializer(result, context={"request": request}).data,
                )
                response_status = status.HTTP_201_CREATED
                merged = False
        response_payload = GoodsDetailSerializer(result, context={"request": request}).data
        response_payload["merged"] = merged
        return Response(response_payload, status=response_status)


class PublicClubGoodsDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, pk, goods_id):
        club = get_object_or_404(_public_club_queryset(), pk=pk)
        item = get_object_or_404(
            ClubCatalogItem.objects.select_related("club", "ip", "category", "theme").prefetch_related(
                "characters__ip", "additional_photos"
            ),
            pk=goods_id,
            club=club,
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        )
        return Response(ClubCatalogPublicSerializer(item, context={"request": request}).data)
