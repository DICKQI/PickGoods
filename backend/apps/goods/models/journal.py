from uuid import uuid4

from django.db import models


class JournalBook(models.Model):
    """
    Editable scrapbook that can contain multiple journal pages.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="手帐本ID",
    )
    user = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="journal_books",
        db_index=True,
        verbose_name="所属用户",
    )
    title = models.CharField(max_length=200, db_index=True, verbose_name="手帐标题")
    description = models.TextField(null=True, blank=True, verbose_name="手帐描述")
    cover_image = models.ImageField(
        upload_to="journals/covers/",
        null=True,
        blank=True,
        verbose_name="手帐封面",
    )
    order = models.BigIntegerField(default=0, db_index=True, verbose_name="排序值")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "手帐本"
        verbose_name_plural = "手帐本"
        ordering = ["order", "-updated_at"]

    def __str__(self):
        return self.title


def default_journal_page_content():
    return {"version": 2, "layers": []}


class JournalPage(models.Model):
    """
    One editable canvas page inside a scrapbook.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="手帐页ID",
    )
    book = models.ForeignKey(
        JournalBook,
        on_delete=models.CASCADE,
        related_name="pages",
        verbose_name="所属手帐本",
    )
    title = models.CharField(max_length=200, default="第 1 页", verbose_name="页面标题")
    page_no = models.PositiveIntegerField(default=1, db_index=True, verbose_name="页码")
    width = models.PositiveIntegerField(default=1080, verbose_name="画布宽度")
    height = models.PositiveIntegerField(default=1440, verbose_name="画布高度")
    background = models.CharField(max_length=50, default="#fffaf0", verbose_name="背景")
    background_style = models.CharField(max_length=20, default="plain", verbose_name="背景样式")
    content = models.JSONField(default=default_journal_page_content, verbose_name="图层内容")
    revision = models.PositiveIntegerField(default=1, verbose_name="内容修订号")
    share_token = models.CharField(
        max_length=64,
        null=True,
        blank=True,
        unique=True,
        db_index=True,
        verbose_name="公开分享令牌",
    )
    preview_image = models.ImageField(
        upload_to="journals/previews/",
        null=True,
        blank=True,
        verbose_name="页面预览图",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")

    class Meta:
        verbose_name = "手帐页"
        verbose_name_plural = "手帐页"
        ordering = ["page_no", "created_at"]
        unique_together = ("book", "page_no")

    def __str__(self):
        return f"{self.book.title} - {self.title}"


class JournalPageVersion(models.Model):
    """
    Saved snapshot of a journal page for rollback.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid4,
        editable=False,
        verbose_name="手帐页版本ID",
    )
    page = models.ForeignKey(
        JournalPage,
        on_delete=models.CASCADE,
        related_name="versions",
        verbose_name="所属手帐页",
    )
    version_no = models.PositiveIntegerField(db_index=True, verbose_name="版本号")
    content = models.JSONField(default=default_journal_page_content, verbose_name="图层内容")
    preview_image = models.ImageField(
        upload_to="journals/version_previews/",
        null=True,
        blank=True,
        verbose_name="版本预览图",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "手帐页版本"
        verbose_name_plural = "手帐页版本"
        ordering = ["-version_no"]
        unique_together = ("page", "version_no")

    def __str__(self):
        return f"{self.page.title} v{self.version_no}"
