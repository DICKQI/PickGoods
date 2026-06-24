from django.apps import AppConfig


class GoodsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.goods'

    def ready(self):
        # 启动 BGM 自动同步调度器（仅在 web 进程中生效）。
        # 通过环境变量 BGM_SCHEDULER_DISABLED=1 可禁用，便于本地/测试场景。
        try:
            from .scheduler import start_scheduler
            start_scheduler()
        except Exception:  # noqa: BLE001 - 调度器异常不应阻断进程启动
            import logging
            logging.getLogger(__name__).exception(
                "Failed to start BGM auto-sync scheduler"
            )