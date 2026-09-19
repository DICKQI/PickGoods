from django.contrib import admin

from .models import AdminAuditLog, AdminAuditRetry


@admin.register(AdminAuditLog)
class AdminAuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "actor",
        "action",
        "resource_type",
        "resource_id",
        "summary",
    )
    list_filter = ("action", "resource_type", "created_at")
    search_fields = ("summary", "resource_id", "actor__username")
    readonly_fields = (
        "actor",
        "action",
        "resource_type",
        "resource_id",
        "summary",
        "changes",
        "ip_address",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(AdminAuditRetry)
class AdminAuditRetryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "attempts",
        "next_attempt_at",
        "resolved_at",
        "last_error",
    )
    list_filter = ("resolved_at", "next_attempt_at")
    ordering = ("resolved_at", "next_attempt_at", "id")
    readonly_fields = (
        "payload",
        "attempts",
        "next_attempt_at",
        "last_error",
        "resolved_at",
        "created_at",
        "updated_at",
    )
