from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminAuditLogViewSet,
    AdminCategoryListView,
    AdminCharacterViewSet,
    AdminGoodsCraftViewSet,
    AdminGoodsViewSet,
    AdminIPViewSet,
    AdminOverviewView,
    AdminRoleViewSet,
    AdminThemeViewSet,
    AdminUserViewSet,
    BGMSyncJobViewSet,
    BGMSyncSettingsView,
    bgm_sync_run_now,
)
from .exports import AdminExportView

router = DefaultRouter()
router.register("users", AdminUserViewSet, basename="admin-users")
router.register("roles", AdminRoleViewSet, basename="admin-roles")
router.register("goods-crafts", AdminGoodsCraftViewSet, basename="admin-goods-crafts")
router.register("goods", AdminGoodsViewSet, basename="admin-goods")
router.register("ips", AdminIPViewSet, basename="admin-ips")
router.register("characters", AdminCharacterViewSet, basename="admin-characters")
router.register("themes", AdminThemeViewSet, basename="admin-themes")
router.register("bgm-sync/jobs", BGMSyncJobViewSet, basename="admin-bgm-sync-jobs")
router.register("audit-logs", AdminAuditLogViewSet, basename="admin-audit-logs")

urlpatterns = [
    path("overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("categories/", AdminCategoryListView.as_view(), name="admin-categories"),
    path("exports/<slug:resource>/", AdminExportView.as_view(), name="admin-export"),
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
