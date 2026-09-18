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

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            from apps.gamification.models import MetricEvent, MetricSourceState

            source_id = str(obj.pk)
            has_ledger = (
                MetricEvent.objects.filter(
                    source_id__in=[source_id, f"preorder:{source_id}"]
                ).exists()
                or MetricSourceState.objects.filter(
                    source_id__in=[source_id, f"preorder:{source_id}"]
                ).exists()
            )
            if has_ledger:
                fields.append("user")
        return tuple(fields)


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
