# Generated for BGM incremental sync feature

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("goods", "0025_themetemplate"),
    ]

    operations = [
        migrations.AddField(
            model_name="ip",
            name="bgm_subject_id",
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                help_text="bangumi.tv 对应作品的 subject_id，用于增量更新精确匹配",
                verbose_name="BGM作品ID",
            ),
        ),
        migrations.AddField(
            model_name="ip",
            name="last_synced_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name="最近一次BGM同步时间",
            ),
        ),
        migrations.AlterField(
            model_name="ip",
            name="bgm_subject_id",
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                unique=True,
                help_text="bangumi.tv 对应作品的 subject_id，用于增量更新精确匹配",
                verbose_name="BGM作品ID",
            ),
        ),
        migrations.AddField(
            model_name="character",
            name="bgm_character_id",
            field=models.PositiveIntegerField(
                blank=True,
                db_index=True,
                null=True,
                help_text="bangumi.tv 对应角色的 character_id，用于增量更新精确匹配",
                verbose_name="BGM角色ID",
            ),
        ),
    ]
