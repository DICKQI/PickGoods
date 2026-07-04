from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.goods.models import GoodsCraft
from apps.users.models import Role, User


class GoodsCraftViewSetTestCase(TestCase):
    """Public goods craft list for authenticated frontend users."""

    def setUp(self):
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(
            username="craft_reader", role=self.user_role, is_active=True
        )
        self.client = APIClient()

    def test_authenticated_user_can_list_active_goods_crafts(self):
        GoodsCraft.objects.create(name="镭射", order=20, is_active=True)
        GoodsCraft.objects.create(name="烫金", order=10, is_active=True)
        GoodsCraft.objects.create(name="停用工艺", order=1, is_active=False)
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/goods-crafts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item["name"] for item in response.json()]
        self.assertEqual(names, ["烫金", "镭射"])

    def test_authenticated_user_can_search_active_goods_crafts(self):
        GoodsCraft.objects.create(name="烫金", order=10, is_active=True)
        GoodsCraft.objects.create(name="珠光", order=20, is_active=True)
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/goods-crafts/?search=烫")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["name"] for item in response.json()], ["烫金"])

    def test_anonymous_user_cannot_list_goods_crafts(self):
        response = self.client.get("/api/goods-crafts/")
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_normal_user_cannot_mutate_goods_crafts(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/goods-crafts/",
            {"name": "烫金"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
