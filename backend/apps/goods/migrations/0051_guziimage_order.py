from django.db import migrations, models


def backfill_guzi_image_order(apps, schema_editor):
    GuziImage = apps.get_model("goods", "GuziImage")
    current_guzi_id = None
    order = 0
    updates = []

    for photo in GuziImage.objects.order_by("guzi_id", "id").iterator():
        if photo.guzi_id != current_guzi_id:
            current_guzi_id = photo.guzi_id
            order = 1
        else:
            order += 1
        if photo.order != order:
            photo.order = order
            updates.append(photo)

    if updates:
        GuziImage.objects.bulk_update(updates, ["order"])


class Migration(migrations.Migration):

    dependencies = [
        ("goods", "0050_backfill_gamification_lifecycle"),
    ]

    operations = [
        migrations.AddField(
            model_name="guziimage",
            name="order",
            field=models.PositiveIntegerField(
                db_index=True,
                default=0,
                help_text="值越小越靠前",
                verbose_name="排序值",
            ),
        ),
        migrations.AlterModelOptions(
            name="guziimage",
            options={
                "ordering": ["order", "id"],
                "verbose_name": "谷子补充图片",
                "verbose_name_plural": "谷子补充图片",
            },
        ),
        migrations.RunPython(
            backfill_guzi_image_order,
            migrations.RunPython.noop,
        ),
    ]
