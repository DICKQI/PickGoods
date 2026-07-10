from uuid import uuid4

from django.db import models

from .catalog import Category, Character, IP
from .theme import Theme


class Goods(models.Model):
    """
    谷子核心表，关联 IP / 角色 / 品类 / 主题 以及 物理位置 StorageNode。
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="资产ID",
    )

    name = models.CharField(
        max_length=200,
        db_index=True,
        verbose_name="谷子名称",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="goods",
        db_index=True,
        verbose_name="所属用户",
    )

    # 多维关联
    ip = models.ForeignKey(
        IP,
        on_delete=models.PROTECT,
        related_name="goods",
        verbose_name="IP作品",
    )
    theme = models.ForeignKey(
        Theme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods",
        verbose_name="主题",
        help_text="谷子所属主题，例如：夏日主题、节日主题等",
    )
    characters = models.ManyToManyField(
        Character,
        related_name="goods",
        verbose_name="角色",
        help_text="可关联多个角色，例如双人立牌可以关联流萤和花火",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="goods",
        verbose_name="品类",
    )
    location = models.ForeignKey(
        "location.StorageNode",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods",
        verbose_name="物理位置",
    )

    # 资产细节
    main_photo = models.ImageField(
        upload_to="goods/main/",
        null=True,
        blank=True,
        verbose_name="主图",
    )
    quantity = models.PositiveIntegerField(default=1, verbose_name="数量")
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="购入单价",
    )
    purchase_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="入手时间",
    )
    is_official = models.BooleanField(
        default=True,
        verbose_name="是否官谷",
    )

    STATUS_CHOICES = (
        ("draft", "草稿"),
        ("in_cabinet", "在馆"),
        ("outdoor", "出街中"),
        ("sold", "已售出"),
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="in_cabinet",
        verbose_name="状态",
    )

    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name="备注",
    )

    # 自定义排序字段：值越小越靠前，默认0
    order = models.BigIntegerField(
        default=0,
        db_index=True,
        verbose_name="自定义排序值",
        help_text="值越小越靠前，默认0",
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "谷子"
        verbose_name_plural = "谷子"
        # 默认排序：先按自定义顺序值从小到大，其次按创建时间倒序（保证新建未手动排序的谷子有稳定顺序）
        ordering = ["order", "-created_at"]
        indexes = [
            models.Index(fields=["location"]),
            models.Index(fields=["user", "location"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return self.name


class GuziImage(models.Model):
    """
    谷子补充图片表，例如背板细节、瑕疵点等。
    """

    guzi = models.ForeignKey(
        Goods,
        on_delete=models.CASCADE,
        related_name="additional_photos",
        verbose_name="关联谷子",
    )
    image = models.ImageField(
        upload_to="goods/extra/",
        verbose_name="补充图片",
    )
    label = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="图片标签",
        help_text="如：背板细节、瑕疵点",
    )

    class Meta:
        verbose_name = "谷子补充图片"
        verbose_name_plural = "谷子补充图片"

    def __str__(self):
        return f"{self.guzi.name} - {self.label or '补充图'}"
