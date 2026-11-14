from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("goods", "0052_guziimage_client_upload_id_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="ip",
            name="cover_image",
            field=models.CharField(
                blank=True,
                help_text="Bangumi 条目封面 URL，或手填的外链 / 服务器相对路径（如 /media/ips/xxx.jpg）",
                max_length=500,
                null=True,
                verbose_name="作品封面",
            ),
        ),
        migrations.AddField(
            model_name="ip",
            name="cover_checked_at",
            field=models.DateTimeField(
                blank=True,
                help_text="最近一次尝试从 Bangumi 解析封面的时间，用于节流重试",
                null=True,
                verbose_name="封面最近检查时间",
            ),
        ),
    ]
