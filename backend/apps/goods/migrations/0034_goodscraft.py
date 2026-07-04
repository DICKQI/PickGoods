from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("goods", "0033_add_location_created_at_indexes"),
    ]

    operations = [
        migrations.CreateModel(
            name="GoodsCraft",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        db_index=True,
                        max_length=100,
                        unique=True,
                        verbose_name="谷子工艺名称",
                    ),
                ),
                (
                    "order",
                    models.IntegerField(
                        db_index=True,
                        default=0,
                        help_text="值越小越靠前",
                        verbose_name="排序值",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(
                        db_index=True,
                        default=True,
                        verbose_name="是否启用",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="创建时间"),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="更新时间"),
                ),
            ],
            options={
                "verbose_name": "谷子工艺",
                "verbose_name_plural": "谷子工艺",
                "ordering": ["order", "id"],
            },
        ),
    ]
