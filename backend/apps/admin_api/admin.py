from django.contrib import admin

from .models import AdminAuditLog, AdminAuditRetry


@admin.register(AdminAuditLog)
class AdminAuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "log_type",
        "outcome",
        "actor",
        "action",
        "resource_type",
        "resource_id",
        "summary",
    )
    list_filter = ("log_type", "outcome", "action", "resource_type", "created_at")
    search_fields = ("summary", "resource_id", "actor__username", "actor_username", "path")
    readonly_fields = (
        "actor",
        "actor_username",
        "subject_user",
        "log_type",
        "outcome",
        "action",
        "resource_type",
        "resource_id",
        "resource_ids",
        "summary",
        "changes",
        "http_method",
        "path",
        "status_code",
        "request_id",
        "user_agent",
        "ip_address",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        # 审计日志只允许追加：Django Admin 也不得删除，避免操作人清除痕迹。
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

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        # 补偿队列同样不允许手工删除，排空请使用 retry_admin_audit_queue 管理命令。
        return False
