from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0003_club_platform_urls"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClubFavorite",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="收藏时间")),
                ("club", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="favorite_users", to="users.club", verbose_name="社团")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="club_favorites", to="users.user", verbose_name="收藏用户")),
            ],
            options={
                "verbose_name": "社团收藏",
                "verbose_name_plural": "社团收藏",
                "ordering": ["-created_at", "-id"],
                "indexes": [
                    models.Index(fields=["user", "-created_at"], name="users_clubf_user_id_f988c0_idx"),
                    models.Index(fields=["club", "-created_at"], name="users_clubf_club_id_d1679c_idx"),
                ],
                "constraints": [models.UniqueConstraint(fields=("user", "club"), name="unique_user_club_favorite")],
            },
        ),
    ]
