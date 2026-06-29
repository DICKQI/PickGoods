# Generated for journal page revision support.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("goods", "0029_journalpageversion"),
    ]

    operations = [
        migrations.AddField(
            model_name="journalpage",
            name="revision",
            field=models.PositiveIntegerField(default=1, verbose_name="内容修订号"),
        ),
    ]
