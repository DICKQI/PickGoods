from uuid import uuid4

from django.db import models

from .catalog import Category, Character, IP
from .theme import Theme


class ClubCatalogItem(models.Model):
    """公开社团目录条目，与个人库存 Goods 完全解耦。"""

    PUBLICATION_DRAFT = "draft"
    PUBLICATION_LISTED = "listed"
    PUBLICATION_UNLISTED = "unlisted"
    PUBLICATION_STATUS_CHOICES = (
        (PUBLICATION_DRAFT, "草稿"),
        (PUBLICATION_LISTED, "上架"),
        (PUBLICATION_UNLISTED, "下架"),
    )

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False, verbose_name="目录条目ID")
    club = models.ForeignKey(
        "users.Club", on_delete=models.CASCADE, related_name="catalog_items", verbose_name="所属社团"
    )
    name = models.CharField(max_length=200, db_index=True, verbose_name="谷子名称")
    description = models.TextField(blank=True, default="", verbose_name="公开说明")
    ip = models.ForeignKey(IP, on_delete=models.PROTECT, related_name="club_catalog_items", verbose_name="IP作品")
    theme = models.ForeignKey(
        Theme, on_delete=models.SET_NULL, null=True, blank=True, related_name="club_catalog_items", verbose_name="主题"
    )
    characters = models.ManyToManyField(Character, related_name="club_catalog_items", verbose_name="角色")
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="club_catalog_items", verbose_name="品类"
    )
    main_photo = models.ImageField(upload_to="club_catalog/main/", null=True, blank=True, verbose_name="主图")
    public_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="公开价格"
    )
    # 社团目录目前统一为同人谷子；保留字段仅用于兼容旧数据和个人导入快照。
    is_official = models.BooleanField(default=False, verbose_name="是否官谷")
    publication_status = models.CharField(
        max_length=20,
        choices=PUBLICATION_STATUS_CHOICES,
        default=PUBLICATION_DRAFT,
        db_index=True,
        verbose_name="发布状态",
    )
    publish_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name="定时上架时间",
    )
    publish_failed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="定时上架失败时间",
    )
    publish_error = models.TextField(
        null=True,
        blank=True,
        verbose_name="定时上架失败原因",
    )
    order = models.BigIntegerField(default=0, db_index=True, verbose_name="排序值")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "社团目录条目"
        verbose_name_plural = "社团目录条目"
        ordering = ["order", "-created_at"]
        indexes = [
            models.Index(fields=["club", "publication_status"]),
            models.Index(fields=["club", "order", "-created_at"]),
        ]

    def __str__(self):
        return self.name


class ClubCatalogImage(models.Model):
    """社团目录的附加公开图片。"""

    item = models.ForeignKey(
        ClubCatalogItem, on_delete=models.CASCADE, related_name="additional_photos", verbose_name="目录条目"
    )
    image = models.ImageField(upload_to="club_catalog/extra/", verbose_name="图片")
    label = models.CharField(max_length=100, null=True, blank=True, verbose_name="图片标签")

    class Meta:
        verbose_name = "社团目录附加图片"
        verbose_name_plural = "社团目录附加图片"

    def __str__(self):
        return f"{self.item.name} - {self.label or '补充图'}"


class ClubGoodsOrigin(models.Model):
    """个人库存与社团目录之间的稳定来源关系。"""

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False, verbose_name="来源关系ID")
    collector = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="club_goods_origins", verbose_name="吃谷人"
    )
    source_item = models.ForeignKey(
        ClubCatalogItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods_origins",
        verbose_name="来源社团条目",
    )
    personal_goods = models.OneToOneField(
        "goods.Goods",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="club_goods_origin",
        verbose_name="个人库存",
    )
    first_source_snapshot = models.JSONField(default=dict, verbose_name="首次来源快照")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="首次导入时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="最近导入时间")

    class Meta:
        verbose_name = "社团谷子来源关系"
        verbose_name_plural = "社团谷子来源关系"
        constraints = [
            models.UniqueConstraint(
                fields=["collector", "source_item"],
                condition=models.Q(collector__isnull=False, source_item__isnull=False),
                name="unique_collector_club_catalog_origin",
            )
        ]
        indexes = [
            models.Index(fields=["collector", "source_item"]),
        ]


class ClubGoodsImportEvent(models.Model):
    OPERATION_CREATED = "created"
    OPERATION_MERGED = "merged"
    OPERATION_CHOICES = (
        (OPERATION_CREATED, "首次导入"),
        (OPERATION_MERGED, "合并数量"),
    )

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False, verbose_name="导入事件ID")
    origin = models.ForeignKey(
        ClubGoodsOrigin, on_delete=models.CASCADE, related_name="events", verbose_name="来源关系"
    )
    operation = models.CharField(max_length=20, choices=OPERATION_CHOICES, verbose_name="操作")
    quantity_added = models.PositiveIntegerField(default=1, verbose_name="增加数量")
    source_snapshot = models.JSONField(default=dict, verbose_name="导入时来源快照")
    goods_snapshot = models.JSONField(default=dict, verbose_name="导入后个人库存快照")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="导入时间")

    class Meta:
        verbose_name = "社团谷子导入事件"
        verbose_name_plural = "社团谷子导入事件"
        ordering = ["-created_at"]
