from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminRoleViewSet,
    AdminUserViewSet,
    BGMSyncJobViewSet,
    BGMSyncSettingsView,
    bgm_sync_run_now,
)

router = DefaultRouter()
router.register("users", AdminUserViewSet, basename="admin-users")
router.register("roles", AdminRoleViewSet, basename="admin-roles")
router.register("bgm-sync/jobs", BGMSyncJobViewSet, basename="admin-bgm-sync-jobs")

urlpatterns = [
    # BGM 同步配置（单例：直接挂在固定路径，避免 pk 占位）
    path(
        "bgm-sync/settings/",
        BGMSyncSettingsView.as_view(),
        name="admin-bgm-sync-settings",
    ),
    path(
        "bgm-sync/run-now/",
        bgm_sync_run_now,
        name="admin-bgm-sync-run-now",
    ),
    path("", include(router.urls)),
]
