from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_user_account_type_user_approval_status_club"),
    ]

    operations = [
        migrations.AddField(
            model_name="club",
            name="taobao_url",
            field=models.URLField(blank=True, default=None, max_length=500, null=True, verbose_name="淘宝链接"),
        ),
        migrations.AddField(
            model_name="club",
            name="xiaohongshu_url",
            field=models.URLField(blank=True, default=None, max_length=500, null=True, verbose_name="小红书链接"),
        ),
        migrations.AddField(
            model_name="club",
            name="weidian_url",
            field=models.URLField(blank=True, default=None, max_length=500, null=True, verbose_name="微店链接"),
        ),
    ]
