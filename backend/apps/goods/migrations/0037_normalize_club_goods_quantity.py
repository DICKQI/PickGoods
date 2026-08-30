from django.db import migrations


def normalize_club_goods_quantity(apps, schema_editor):
    Goods = apps.get_model("goods", "Goods")
    Goods.objects.filter(user__account_type="club").exclude(quantity=1).update(quantity=1)


class Migration(migrations.Migration):

    dependencies = [
        ("goods", "0036_goods_is_published_goods_source_club_goods_and_more"),
        ("users", "0002_user_account_type_user_approval_status_club"),
    ]

    operations = [
        migrations.RunPython(normalize_club_goods_quantity, migrations.RunPython.noop),
    ]
