from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("goods", "0031_journalpage_background_style"),
    ]

    operations = [
        migrations.AddField(
            model_name="journalpage",
            name="share_token",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=64,
                null=True,
                unique=True,
                verbose_name="公开分享令牌",
            ),
        ),
    ]
