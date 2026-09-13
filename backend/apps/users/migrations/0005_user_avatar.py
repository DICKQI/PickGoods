from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_clubfavorite"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar",
            field=models.ImageField(blank=True, null=True, upload_to="users/avatars/", verbose_name="用户头像"),
        ),
    ]
