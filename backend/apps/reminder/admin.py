from django.contrib import admin

from .models import Notification, Preorder, PreorderDelayRecord


@admin.register(Preorder)
class PreorderAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "status", "estimated_month", "delay_count", "deposit_amount", "created_at")
    list_filter = ("status",)
    search_fields = ("name", "user__username")
    readonly_fields = ("status", "paid_at", "goods")

    def has_delete_permission(self, request, obj=None):
        if obj and obj.status in {Preorder.STATUS_PAID, Preorder.STATUS_CONVERTED}:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(PreorderDelayRecord)
class PreorderDelayRecordAdmin(admin.ModelAdmin):
    list_display = ("preorder", "from_month", "to_month", "reason", "created_at")
    list_filter = ("reason",)
    search_fields = ("preorder__name",)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "type", "is_read", "is_stale", "created_at")
    list_filter = ("type", "is_read", "is_stale")
    search_fields = ("title", "user__username")
