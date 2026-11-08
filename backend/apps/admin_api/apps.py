from django.apps import AppConfig


class AdminApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.admin_api"
    verbose_name = "Admin API"

    def ready(self):
        # Django Admin 站点的写操作也要进入统一操作日志。
        from core.admin_audit import install_admin_site_audit

        install_admin_site_audit()
