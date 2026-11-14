"""个人 Bangumi Access Token 接口测试（``/api/auth/me/bgm-token/``）。

要点：token 原文永远不出现在任何响应里，只回显 ``is_set`` 与 ``****abcd`` 掩码。
"""
from django.core.cache import cache
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import Role, User

TOKEN_URL = "/api/auth/me/bgm-token/"
ME_URL = "/api/auth/me/"


class BGMTokenEndpointTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="bgmtoken_user", role=self.role)
        self.client.force_authenticate(user=self.user)

    def test_me_reports_token_not_configured(self):
        response = self.client.get(ME_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertFalse(data["bgm_token_is_set"])
        self.assertIsNone(data["bgm_token_hint"])
        self.assertIn("personal_ip_enabled", data)

    def test_save_token_masks_value_and_persists(self):
        response = self.client.post(
            TOKEN_URL, {"access_token": "abcdef123456"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(), {"is_set": True, "hint": "****3456"}
        )

        self.user.refresh_from_db()
        self.assertEqual(self.user.bgm_access_token, "abcdef123456")

        me = self.client.get(ME_URL).json()
        self.assertTrue(me["bgm_token_is_set"])
        self.assertEqual(me["bgm_token_hint"], "****3456")
        # 原文绝不出现在响应里
        self.assertNotIn("abcdef123456", str(me))

    def test_clear_token(self):
        self.client.post(TOKEN_URL, {"access_token": "tok-1234"}, format="json")
        response = self.client.delete(TOKEN_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"is_set": False, "hint": None})

        self.user.refresh_from_db()
        self.assertEqual(self.user.bgm_access_token, "")
        self.assertFalse(self.client.get(ME_URL).json()["bgm_token_is_set"])

    def test_blank_token_is_rejected(self):
        response = self.client.post(TOKEN_URL, {"access_token": "   "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.bgm_access_token, "")

    def test_too_long_token_is_rejected(self):
        response = self.client.post(
            TOKEN_URL, {"access_token": "x" * 201}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymous_is_rejected(self):
        self.client.force_authenticate(user=None)
        self.assertIn(
            self.client.post(TOKEN_URL, {"access_token": "abc"}, format="json").status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_admin_serializer_does_not_expose_token(self):
        """管理员视角的用户列表也不能看到 token 原文。"""
        from apps.admin_api.serializers import AdminUserSerializer

        self.user.bgm_access_token = "admin-visible"
        self.user.save(update_fields=["bgm_access_token"])
        data = AdminUserSerializer(self.user).data
        self.assertNotIn("bgm_access_token", data)
        self.assertNotIn("admin-visible", str(data))
