from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from .models import Role, User
from .serializers import RegisterSerializer, LoginSerializer, build_token_response


SECRET = "test-secret-key"


class RegisterSerializerTestCase(TestCase):
    """users.serializers — RegisterSerializer"""

    def test_valid_data_creates_user(self):
        data = {"username": "newuser", "password": "secure123"}
        serializer = RegisterSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertEqual(user.username, "newuser")
        self.assertTrue(user.check_password("secure123"))
        self.assertEqual(user.role.name, "User")

    def test_duplicate_username_rejected(self):
        role, _ = Role.objects.get_or_create(name="User")
        User.objects.create(username="existing", role=role)
        data = {"username": "existing", "password": "secure123"}
        serializer = RegisterSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("username", serializer.errors)

    def test_empty_username_rejected(self):
        data = {"username": "   ", "password": "secure123"}
        serializer = RegisterSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("username", serializer.errors)

    def test_short_password_rejected(self):
        data = {"username": "user1", "password": "12345"}
        serializer = RegisterSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("password", serializer.errors)


class LoginSerializerTestCase(TestCase):
    """users.serializers — LoginSerializer"""

    def test_valid_data(self):
        data = {"username": "user", "password": "pass123"}
        serializer = LoginSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_missing_password(self):
        data = {"username": "user"}
        serializer = LoginSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("password", serializer.errors)


class BuildTokenResponseTestCase(TestCase):
    """users.serializers — build_token_response"""

    @override_settings(JWT_SECRET=SECRET)
    def test_returns_correct_structure(self):
        role, _ = Role.objects.get_or_create(name="User")
        user = User.objects.create(username="tokentest", role=role)
        result = build_token_response(user=user, secret=SECRET, ttl_seconds=3600)
        self.assertIn("access_token", result)
        self.assertEqual(result["token_type"], "Bearer")
        self.assertEqual(result["expires_in"], 3600)
        self.assertIsInstance(result["access_token"], str)
        self.assertGreater(len(result["access_token"]), 0)


# ─── Auth views ──────────────────────────────────────────────────────


class RegisterViewTestCase(TestCase):
    """POST /api/auth/register/"""

    def setUp(self):
        self.client = APIClient()

    def test_register_success(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "newuser", "password": "secure123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["token_type"], "Bearer")

    def test_register_duplicate_username(self):
        role, _ = Role.objects.get_or_create(name="User")
        User.objects.create(username="existing", role=role)
        response = self.client.post(
            "/api/auth/register/",
            {"username": "existing", "password": "secure123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_short_password(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "user1", "password": "12"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_empty_username(self):
        response = self.client.post(
            "/api/auth/register/",
            {"username": "", "password": "secure123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginViewTestCase(TestCase):
    """POST /api/auth/login/"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="loginuser", role=self.role)
        self.user.set_password("correctpass")
        self.user.save()

    def test_login_success(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "loginuser", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("access_token", data)

    def test_login_wrong_password(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "loginuser", "password": "wrongpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_nonexistent_user(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "nobody", "password": "pass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_inactive_user(self):
        self.user.is_active = False
        self.user.save()
        response = self.client.post(
            "/api/auth/login/",
            {"username": "loginuser", "password": "correctpass"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class MeViewTestCase(TestCase):
    """GET /api/auth/me/"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="meuser", role=self.role)
        self.user.set_password("pass123")
        self.user.save()

    def test_me_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["username"], "meuser")
        self.assertIn("role", data)

    def test_me_unauthenticated(self):
        response = self.client.get("/api/auth/me/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


class LogoutViewTestCase(TestCase):
    """DELETE /api/auth/logout/"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="logoutuser", role=self.role)

    def test_logout_authenticated(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.delete("/api/auth/logout/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_logout_unauthenticated(self):
        response = self.client.delete("/api/auth/logout/")
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
