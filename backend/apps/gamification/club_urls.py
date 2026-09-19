from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .club_views import (
    ClubAchievementSetViewSet,
    ClubAchievementViewSet,
    ClubRewardViewSet,
)

router = DefaultRouter()
router.register(
    "sets",
    ClubAchievementSetViewSet,
    basename="club-gamification-sets",
)
router.register(
    "achievements",
    ClubAchievementViewSet,
    basename="club-gamification-achievements",
)
router.register(
    "rewards",
    ClubRewardViewSet,
    basename="club-gamification-rewards",
)

urlpatterns = [
    path("", include(router.urls)),
]
