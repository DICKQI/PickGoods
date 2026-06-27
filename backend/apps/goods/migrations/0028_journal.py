# Generated for journal book feature.

import apps.goods.models
import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("goods", "0027_bgm_sync_audit"),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="JournalBook",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        verbose_name="手帐本ID",
                    ),
                ),
                ("title", models.CharField(db_index=True, max_length=200, verbose_name="手帐标题")),
                ("description", models.TextField(blank=True, null=True, verbose_name="手帐描述")),
                (
                    "cover_image",
                    models.ImageField(
                        blank=True,
                        null=True,
                        upload_to="journals/covers/",
                        verbose_name="手帐封面",
                    ),
                ),
                ("order", models.BigIntegerField(db_index=True, default=0, verbose_name="排序值")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="创建时间")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新时间")),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="journal_books",
                        to="users.user",
                        verbose_name="所属用户",
                    ),
                ),
            ],
            options={
                "verbose_name": "手帐本",
                "verbose_name_plural": "手帐本",
                "ordering": ["order", "-updated_at"],
            },
        ),
        migrations.CreateModel(
            name="JournalPage",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                        verbose_name="手帐页ID",
                    ),
                ),
                ("title", models.CharField(default="第 1 页", max_length=200, verbose_name="页面标题")),
                ("page_no", models.PositiveIntegerField(db_index=True, default=1, verbose_name="页码")),
                ("width", models.PositiveIntegerField(default=1080, verbose_name="画布宽度")),
                ("height", models.PositiveIntegerField(default=1440, verbose_name="画布高度")),
                ("background", models.CharField(default="#fffaf0", max_length=50, verbose_name="背景")),
                (
                    "content",
                    models.JSONField(
                        default=apps.goods.models.default_journal_page_content,
                        verbose_name="图层内容",
                    ),
                ),
                (
                    "preview_image",
                    models.ImageField(
                        blank=True,
                        null=True,
                        upload_to="journals/previews/",
                        verbose_name="页面预览图",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="创建时间")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="更新时间")),
                (
                    "book",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pages",
                        to="goods.journalbook",
                        verbose_name="所属手帐本",
                    ),
                ),
            ],
            options={
                "verbose_name": "手帐页",
                "verbose_name_plural": "手帐页",
                "ordering": ["page_no", "created_at"],
                "unique_together": {("book", "page_no")},
            },
        ),
    ]
