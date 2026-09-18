from django.urls import path

from .views import (
    ClaimAchievementView,
    EquipmentView,
    OverviewView,
    PublicBadgesView,
    RewardListView,
    SeenView,
    SummaryView,
)

urlpatterns = [
    path("summary/", SummaryView.as_view(), name="gamification-summary"),
    path("overview/", OverviewView.as_view(), name="gamification-overview"),
    path("rewards/", RewardListView.as_view(), name="gamification-rewards"),
    path(
        "achievements/<int:pk>/claim/",
        ClaimAchievementView.as_view(),
        name="gamification-achievement-claim",
    ),
    path("equipment/", EquipmentView.as_view(), name="gamification-equipment"),
    path("public-badges/", PublicBadgesView.as_view(), name="gamification-public-badges"),
    path("seen/", SeenView.as_view(), name="gamification-seen"),
]
