from django.contrib import admin

from .models import Notification, Preorder


@admin.register(Preorder)
class PreorderAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "status", "estimated_month", "deposit_amount", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "user__username")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "type", "is_read", "is_stale", "created_at")
    list_filter = ("type", "is_read", "is_stale")
    search_fields = ("title", "user__username")
