from django.db import models

from .catalog import Character, IP


class Theme(models.Model):
    """
    主题表，例如：夏日主题、节日主题、限定主题等
    """

    name = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="主题名称",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="themes",
        db_index=True,
        verbose_name="所属用户",
    )
    DESCRIPTION_DEFAULT = (
        "店铺：\n"
        "工艺：\n"
        "画师：\n"
        "主题："
    )
    description = models.TextField(
        null=True,
        blank=True,
        default=DESCRIPTION_DEFAULT,
        verbose_name="主题描述",
        help_text="主题的详细描述信息",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        null=True,
        blank=True,
        verbose_name="创建时间",
    )

    class Meta:
        verbose_name = "主题"
        verbose_name_plural = "主题"
        ordering = ["created_at"]
        unique_together = ("user", "name")

    def __str__(self):
        return self.name


class ThemeImage(models.Model):
    """
    主题附加图片表，例如：海报、物料细节等。
    """

    theme = models.ForeignKey(
        Theme,
        on_delete=models.CASCADE,
        related_name="images",
        verbose_name="所属主题",
    )
    image = models.ImageField(
        upload_to="themes/extra/",
        verbose_name="主题附加图片",
    )
    label = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="图片标签",
        help_text="如：海报、物料细节",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        null=True,
        blank=True,
        verbose_name="创建时间",
    )

    class Meta:
        verbose_name = "主题附加图片"
        verbose_name_plural = "主题附加图片"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.theme.name} - {self.label or '附加图'}"


class ThemeTemplate(models.Model):
    """
    Default goods fields captured from a theme creation flow.
    """

    theme = models.OneToOneField(
        Theme,
        on_delete=models.CASCADE,
        related_name="template",
        verbose_name="关联主题",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="theme_templates",
        db_index=True,
        verbose_name="所属用户",
    )
    name = models.CharField(
        max_length=200,
        verbose_name="谷子名称",
    )
    ip = models.ForeignKey(
        IP,
        on_delete=models.PROTECT,
        related_name="theme_templates",
        verbose_name="IP作品",
    )
    characters = models.ManyToManyField(
        Character,
        related_name="theme_templates",
        blank=True,
        verbose_name="角色",
    )
    purchase_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="入手日期",
    )
    is_official = models.BooleanField(
        default=False,
        verbose_name="是否官谷",
    )
    notes = models.TextField(
        null=True,
        blank=True,
        verbose_name="备注",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "主题模板"
        verbose_name_plural = "主题模板"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.theme.name} template"
