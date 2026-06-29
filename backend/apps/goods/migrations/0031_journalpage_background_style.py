# Generated for journal page background styles.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("goods", "0030_journalpage_revision"),
    ]

    operations = [
        migrations.AddField(
            model_name="journalpage",
            name="background_style",
            field=models.CharField(default="plain", max_length=20, verbose_name="背景样式"),
        ),
    ]
