from __future__ import annotations

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Count, Min, Prefetch, Q
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
    ClubCatalogItem,
    ClubCatalogImage,
    ClubGoodsImportEvent,
    ClubGoodsOrigin,
    Goods,
    GuziImage,
    Theme,
    ThemeImage,
    ThemeTemplate,
)
from apps.goods.serializers.goods import GoodsDetailSerializer
from apps.goods.utils import compress_image
from core.permissions import IsClubAccount, is_admin

from .club_serializers import (
    ClubCatalogImageSerializer,
    ClubCatalogItemSerializer,
    ClubCatalogPublicSerializer,
    ClubDirectorySerializer,
    ClubImportSerializer,
    ClubImportTemplateSerializer,
    ClubPopularitySerializer,
    ClubSerializer,
)
from .models import Club, User


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
        return Response(ClubSerializer(club, context={"request": request}).data)

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
        image = request.FILES.get("avatar")
        if not image:
            return Response({"detail": "请提供 avatar 文件"}, status=status.HTTP_400_BAD_REQUEST)
        club.avatar = image
        club.save(update_fields=["avatar", "updated_at"])
        return Response(ClubSerializer(club, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="goods")
    def goods(self, request, pk=None):
        club = get_object_or_404(self.get_queryset(), pk=pk)
        queryset = ClubCatalogItem.objects.filter(
            club=club,
            publication_status=ClubCatalogItem.PUBLICATION_LISTED,
        ).select_related("club", "ip", "category", "theme").prefetch_related(
            "characters__ip", "additional_photos"
        )
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
        items = ClubCatalogItem.objects.filter(club=club).annotate(
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
        ).order_by("order", "-created_at")
        data = ClubPopularitySerializer([
            {
                "goods_id": item.id,
                "goods_name": item.name,
                "intended_user_count": item.intended_user_count,
                "acquired_user_count": item.acquired_user_count,
            }
            for item in items
        ], many=True).data
        return Response(data)


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
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def perform_create(self, serializer):
        club = self._club()
        min_order = ClubCatalogItem.objects.filter(club=club).aggregate(min_order=Min("order"))["min_order"]
        serializer.save(club=club, order=(min_order or 0) - 1000)

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
            collector=request.user, source_item=source, personal_goods__isnull=False
        ).select_related("personal_goods").first()
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
                "is_official": source.is_official,
                "status": "intended",
            },
            "existing": {
                "goods_id": str(existing_origin.personal_goods_id),
                "quantity": existing_origin.personal_goods.quantity,
            } if existing_origin else None,
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
                    is_official=values.get("is_official", source.is_official),
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
