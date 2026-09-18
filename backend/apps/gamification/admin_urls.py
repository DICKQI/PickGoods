from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminAchievementSetViewSet,
    AdminAchievementViewSet,
    AdminRewardViewSet,
    AdminUserProgressViewSet,
)

router = DefaultRouter()
router.register("sets", AdminAchievementSetViewSet, basename="admin-gamification-sets")
router.register("achievements", AdminAchievementViewSet, basename="admin-gamification-achievements")
router.register("rewards", AdminRewardViewSet, basename="admin-gamification-rewards")
router.register("users", AdminUserProgressViewSet, basename="admin-gamification-users")

urlpatterns = [
    path("", include(router.urls)),
]
