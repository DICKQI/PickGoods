from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import Role, User


class AdminUserViewSetTestCase(TestCase):
    """admin_api — AdminUserViewSet CRUD + 权限"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(
            username="admin1", role=self.admin_role, is_active=True
        )
        self.admin.set_password("adminpass")
        self.admin.save()
        self.normal_user = User.objects.create(
            username="normal1", role=self.user_role, is_active=True
        )
        self.normal_user.set_password("userpass")
        self.normal_user.save()
        self.client = APIClient()

    def test_normal_user_cannot_list_users(self):
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.get("/api/admin/users/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_list_users(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertGreaterEqual(len(items), 2)

    def test_admin_can_create_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/admin/users/",
            {
                "username": "newuser",
                "password": "newpass123",
                "role_id": self.user_role.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["username"], "newuser")
        self.assertNotIn("password", data)  # password not exposed

    def test_admin_create_duplicate_username(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/admin/users/",
            {
                "username": "normal1",  # already exists
                "password": "newpass123",
                "role_id": self.user_role.id,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_can_retrieve_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f"/api/admin/users/{self.normal_user.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["username"], "normal1")

    def test_admin_can_update_user(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/admin/users/{self.normal_user.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.normal_user.refresh_from_db()
        self.assertFalse(self.normal_user.is_active)

    def test_admin_can_update_password(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f"/api/admin/users/{self.normal_user.id}/",
            {"password": "newsecurepass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.normal_user.refresh_from_db()
        self.assertTrue(self.normal_user.check_password("newsecurepass"))

    def test_unauthenticated_cannot_access(self):
        response = self.client.get("/api/admin/users/")
        self.assertIn(
            response.status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )


class AdminRoleViewSetTestCase(TestCase):
    """admin_api — AdminRoleViewSet"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(
            username="adminrole", role=self.admin_role, is_active=True
        )
        self.client = APIClient()

    def test_admin_can_list_roles(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/admin/roles/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        role_names = {r["name"] for r in items}
        self.assertIn("Admin", role_names)
        self.assertIn("User", role_names)

    def test_normal_user_cannot_list_roles(self):
        normal = User.objects.create(
            username="norole", role=self.user_role, is_active=True
        )
        self.client.force_authenticate(user=normal)
        response = self.client.get("/api/admin/roles/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
