from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("location", "0006_alter_storagenode_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="storagenode",
            name="capacity",
            field=models.PositiveIntegerField(
                blank=True,
                help_text="可选容量上限，用于展示占用率",
                null=True,
                verbose_name="容量",
            ),
        ),
        migrations.AddField(
            model_name="storagenode",
            name="code",
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text="短编号，例如 A-03-02，便于实物标签和快速查找",
                max_length=50,
                null=True,
                verbose_name="位置编号",
            ),
        ),
        migrations.AddField(
            model_name="storagenode",
            name="is_favorite",
            field=models.BooleanField(default=False, db_index=True, verbose_name="常用位置"),
        ),
        migrations.AddField(
            model_name="storagenode",
            name="node_type",
            field=models.CharField(
                choices=[
                    ("room", "房间"),
                    ("cabinet", "柜子"),
                    ("shelf", "层板"),
                    ("drawer", "抽屉"),
                    ("box", "收纳盒"),
                    ("custom", "自定义"),
                ],
                default="custom",
                max_length=20,
                verbose_name="节点类型",
            ),
        ),
        migrations.AddField(
            model_name="storagenode",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="更新时间"),
        ),
    ]
