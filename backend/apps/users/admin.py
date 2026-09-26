from django.contrib import admin

from .models import Permission, Role, User


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "created_at")
    search_fields = ("name",)
    ordering = ("id",)
    readonly_fields = ("created_at",)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "role", "is_active", "created_at", "updated_at")
    list_filter = ("role", "is_active", "created_at")
    search_fields = ("username",)
    autocomplete_fields = ("role",)
    ordering = ("id",)
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 50

    def save_model(self, request, obj, form, change):
        revoke_tokens = False
        if change:
            revoke_tokens = "password" in form.changed_data
            if (
                not revoke_tokens
                and "is_active" in form.changed_data
                and form.initial.get("is_active")
                and not obj.is_active
            ):
                revoke_tokens = True
        super().save_model(request, obj, form, change)
        if revoke_tokens:
            obj.revoke_tokens()


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "created_at")
    search_fields = ("code", "name")
    ordering = ("id",)
    readonly_fields = ("created_at",)

