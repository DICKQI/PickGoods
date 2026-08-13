from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import NotificationViewSet, PreorderViewSet

router = DefaultRouter()
router.register("preorders", PreorderViewSet, basename="preorders")
router.register("notifications", NotificationViewSet, basename="notifications")

urlpatterns = [
    path("", include(router.urls)),
]
