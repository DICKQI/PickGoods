from uuid import uuid4

from django.db import models

from .goods import Goods


class Showcase(models.Model):
    """
    展柜模型，用于自定义展示谷子。
    用户可以创建多个展柜，每个展柜可以包含多个分类（归纳）。
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="展柜ID",
    )
    name = models.CharField(
        max_length=200,
        db_index=True,
        verbose_name="展柜名称",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="showcases",
        db_index=True,
        verbose_name="所属用户",
    )
    description = models.TextField(
        null=True,
        blank=True,
        verbose_name="展柜描述",
    )
    cover_image = models.ImageField(
        upload_to="showcases/covers/",
        null=True,
        blank=True,
        verbose_name="封面图片",
    )
    order = models.BigIntegerField(
        default=0,
        db_index=True,
        verbose_name="排序值",
        help_text="值越小越靠前，默认0",
    )
    is_public = models.BooleanField(
        default=True,
        verbose_name="是否公开",
        help_text="预留字段，用于未来扩展",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "展柜"
        verbose_name_plural = "展柜"
        ordering = ["order", "-created_at"]

    def __str__(self):
        return self.name


class ShowcaseGoods(models.Model):
    """
    展柜谷子关联模型，用于将谷子添加到展柜中。
    同一谷子在同一展柜中只能出现一次。
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="关联ID",
    )
    showcase = models.ForeignKey(
        Showcase,
        on_delete=models.CASCADE,
        related_name="showcase_goods",
        verbose_name="所属展柜",
    )
    goods = models.ForeignKey(
        Goods,
        on_delete=models.CASCADE,
        related_name="showcases",
        verbose_name="关联谷子",
        help_text="删除谷子时自动从展柜中移除",
    )
    order = models.BigIntegerField(
        default=0,
        db_index=True,
        verbose_name="排序值",
        help_text="用于在分类内排序，值越小越靠前",
    )
    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name="备注",
        help_text="在展柜中的特殊说明",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "展柜谷子关联"
        verbose_name_plural = "展柜谷子关联"
        ordering = ["order", "-created_at"]
        unique_together = ("showcase", "goods")

    def __str__(self):
        return f"{self.showcase.name} - {self.goods.name}"
