"""
主题（Theme）相关的视图
"""
from django.core.files.base import ContentFile
from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters as drf_filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from ..models import Goods, Theme, ThemeImage
from ..serializers import ThemeDetailSerializer, ThemeImageSerializer, ThemeSimpleSerializer, ThemeTemplateSerializer
from ..utils import compress_image
from core.permissions import IsOwnerOnly, is_admin


class ThemeViewSet(viewsets.ModelViewSet):
    """
    主题CRUD接口。

    - list: 获取所有主题列表
    - retrieve: 获取单个主题详情（含附加图片）
    - create: 创建新主题
    - update: 更新主题
    - partial_update: 部分更新主题
    - destroy: 删除主题
    - upload_images: 上传/更新主题附加图片
    - delete_theme_image: 删除单张主题附加图片
    - delete_theme_images: 批量删除主题附加图片
    """

    queryset = Theme.objects.all().order_by("created_at")
    filter_backends = (DjangoFilterBackend, drf_filters.SearchFilter)
    search_fields = ("name", "description")
    filterset_fields = {
        "name": ["exact", "icontains"],
        "user": ["exact"],
    }
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    permission_classes = [IsOwnerOnly]

    def get_queryset(self):
        """优化查询，统计关联的谷子数量，详情时预取附加图片"""
        qs = (
            Theme.objects.all()
            .annotate(goods_count=Count("goods"))
            .order_by("created_at")
        )
        user = getattr(self.request, "user", None)
        if not user or not getattr(user, "id", None):
            return qs.none()
        if not is_admin(user):
            qs = qs.filter(user=user)
        if self.action in (
            "retrieve",
            "template",
            "upload_images",
            "copy_images_from_goods",
            "delete_theme_image",
            "delete_theme_images",
        ):
            qs = qs.prefetch_related("images", "template__characters__ip")
        return qs

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action in ("create", "update", "partial_update", "retrieve"):
            return ThemeDetailSerializer
        return ThemeSimpleSerializer

    def perform_create(self, serializer):
        user = self.request.user
        uid = serializer.validated_data.get("user_id")
        if uid is not None and is_admin(self.request.user):
            user = uid
        serializer.save(user=user)

    @action(detail=True, methods=["get", "post"], url_path="template")
    def template(self, request, pk=None):
        """Read or upsert the template defaults linked to a theme."""
        instance = self.get_object()

        if request.method.lower() == "get":
            template_obj = getattr(instance, "template", None)
            template_data = None
            if template_obj is not None:
                template_data = ThemeTemplateSerializer(
                    template_obj,
                    context=self.get_serializer_context(),
                ).data
            images = ThemeImageSerializer(
                instance.images.all(),
                many=True,
                context=self.get_serializer_context(),
            ).data
            return Response(
                {"template": template_data, "images": images},
                status=status.HTTP_200_OK,
            )

        template_obj = getattr(instance, "template", None)
        serializer = ThemeTemplateSerializer(
            template_obj,
            data=request.data,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(theme=instance, user=instance.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _copy_theme_image_from_field(self, theme, image_field, label):
        if not image_field or not getattr(image_field, "name", ""):
            return None
        filename = image_field.name.split("/")[-1]
        compressed = compress_image(image_field, max_size_kb=300)
        source = compressed or image_field
        source.seek(0)
        content = ContentFile(source.read())
        filename = source.name.split("/")[-1]
        theme_image = ThemeImage(theme=theme, label=label)
        theme_image.image.save(filename, content, save=True)
        return theme_image

    @action(detail=True, methods=["post"], url_path="copy-images-from-goods")
    def copy_images_from_goods(self, request, pk=None):
        """Copy a goods item's main and additional photos into the theme image pool."""
        instance = self.get_object()
        goods_id = request.data.get("goods_id")
        if not goods_id:
            return Response(
                {"detail": "请提供 goods_id"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            goods = (
                Goods.objects.select_related("theme", "user")
                .prefetch_related("additional_photos")
                .get(id=goods_id, user=instance.user)
            )
        except Goods.DoesNotExist:
            return Response(
                {"detail": "谷子不存在或不属于当前主题用户"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if goods.theme_id != instance.id:
            return Response(
                {"detail": "只能复制属于该主题的谷子图片"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        copied = []
        main_copy = self._copy_theme_image_from_field(instance, goods.main_photo, "主图")
        if main_copy is not None:
            copied.append(main_copy)
        for photo in goods.additional_photos.all():
            copied_photo = self._copy_theme_image_from_field(
                instance,
                photo.image,
                photo.label or "附件图片",
            )
            if copied_photo is not None:
                copied.append(copied_photo)

        if hasattr(instance, "_prefetched_objects_cache"):
            instance._prefetched_objects_cache.pop("images", None)
        serializer = ThemeDetailSerializer(
            instance,
            context=self.get_serializer_context(),
        )
        return Response(
            {"copied_count": len(copied), **serializer.data},
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="upload-images",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_images(self, request, pk=None):
        """
        为主题上传/更新多张附加图片。使用 multipart/form-data。
        - additional_photos：文件数组，可一次上传多张图片
        - photo_ids：整数数组，可选，与 additional_photos 一一对应时表示更新已有图片
        - label：统一标签字符串，可选
        """
        instance = self.get_object()
        additional_photos = request.FILES.getlist("additional_photos")
        photo_ids = request.data.getlist("photo_ids")
        label = request.data.get("label", "").strip()

        if not additional_photos and not photo_ids:
            return Response(
                {"detail": "请提供 additional_photos 文件或 photo_ids 参数"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if photo_ids and additional_photos and len(photo_ids) != len(additional_photos):
            return Response(
                {"detail": "photo_ids 数量必须与 additional_photos 数量一致"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 仅更新标签
        if photo_ids and not additional_photos:
            for photo_id_str in photo_ids:
                try:
                    photo_id = int(photo_id_str)
                    theme_image = ThemeImage.objects.get(id=photo_id, theme=instance)
                    theme_image.label = label if label else None
                    theme_image.save()
                except (ThemeImage.DoesNotExist, ValueError):
                    return Response(
                        {"detail": f"图片 ID {photo_id_str} 不存在或不属于该主题"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            serializer = ThemeDetailSerializer(
                instance, context=self.get_serializer_context()
            )
            return Response(serializer.data, status=status.HTTP_200_OK)

        # 创建新图片或同时更新图片和标签
        for idx, photo in enumerate(additional_photos):
            compressed = compress_image(photo, max_size_kb=300)
            image_file = compressed or photo

            if photo_ids and idx < len(photo_ids):
                try:
                    photo_id = int(photo_ids[idx])
                    theme_image = ThemeImage.objects.get(id=photo_id, theme=instance)
                    theme_image.image = image_file
                    theme_image.label = label if label else None
                    theme_image.save()
                except (ThemeImage.DoesNotExist, ValueError):
                    return Response(
                        {"detail": f"图片 ID {photo_ids[idx]} 不存在或不属于该主题"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            else:
                ThemeImage.objects.create(
                    theme=instance,
                    image=image_file,
                    label=label if label else None,
                )

        serializer = ThemeDetailSerializer(
            instance, context=self.get_serializer_context()
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["delete"],
        url_path="images/(?P<photo_id>[^/.]+)",
    )
    def delete_theme_image(self, request, pk=None, photo_id=None):
        """删除单张主题附加图片。URL: /api/themes/{id}/images/{photo_id}/"""
        instance = self.get_object()
        try:
            photo_id = int(photo_id)
            theme_image = ThemeImage.objects.get(id=photo_id, theme=instance)
            theme_image.delete()
        except (ThemeImage.DoesNotExist, ValueError):
            return Response(
                {"detail": "附加图片不存在或不属于该主题"},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = ThemeDetailSerializer(
            instance, context=self.get_serializer_context()
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["delete"],
        url_path="images",
    )
    def delete_theme_images(self, request, pk=None):
        """批量删除主题附加图片。URL: /api/themes/{id}/images/?photo_ids=1,2,3"""
        instance = self.get_object()
        photo_ids_param = request.query_params.get("photo_ids", "").strip()

        if not photo_ids_param:
            return Response(
                {"detail": "请提供 photo_ids 查询参数，多个ID用逗号分隔，例如：?photo_ids=1,2,3"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            photo_ids = [int(pid.strip()) for pid in photo_ids_param.split(",") if pid.strip()]
            if not photo_ids:
                return Response(
                    {"detail": "photo_ids 参数格式错误，请使用逗号分隔的整数ID"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            theme_images = ThemeImage.objects.filter(id__in=photo_ids, theme=instance)
            deleted_count = theme_images.count()

            if deleted_count != len(photo_ids):
                found_ids = set(theme_images.values_list("id", flat=True))
                missing_ids = [pid for pid in photo_ids if pid not in found_ids]
                return Response(
                    {"detail": f"以下图片ID不存在或不属于该主题: {missing_ids}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            theme_images.delete()

            serializer = ThemeDetailSerializer(
                instance, context=self.get_serializer_context()
            )
            return Response(serializer.data, status=status.HTTP_200_OK)

        except ValueError:
            return Response(
                {"detail": "photo_ids 参数格式错误，请使用逗号分隔的整数ID"},
                status=status.HTTP_400_BAD_REQUEST,
            )


