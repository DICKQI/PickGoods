from datetime import timedelta
from unittest.mock import patch

from captcha.models import CaptchaStore
from django.conf import settings
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from .models import Role, User
from .serializers import RegisterSerializer, LoginSerializer, build_token_response
from .throttling import LoginIPRateThrottle, LoginUsernameRateThrottle, RegisterRateThrottle


SECRET = "test-secret-key"


@override_settings(REGISTER_CAPTCHA_ENABLED=False)
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


@override_settings(REGISTER_CAPTCHA_ENABLED=False)
class RegisterViewTestCase(TestCase):
    """POST /api/auth/register/"""

    def setUp(self):
        cache.clear()
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
        cache.clear()
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


class CaptchaRegistrationTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def _challenge(self):
        response = self.client.get("/api/auth/captcha/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.json()

    def _register(self, username, key=None, code=None):
        payload = {"username": username, "password": "secure123"}
        if key is not None:
            payload["captcha_key"] = key
        if code is not None:
            payload["captcha_code"] = code
        return self.client.post("/api/auth/register/", payload, format="json")

    def test_captcha_challenge_and_image_contract(self):
        challenge = self._challenge()
        self.assertTrue(challenge["enabled"])
        self.assertTrue(challenge["key"])
        self.assertEqual(
            challenge["image"],
            f'/api/auth/captcha/{challenge["key"]}/image/',
        )
        image = self.client.get(challenge["image"])
        self.assertEqual(image.status_code, status.HTTP_200_OK)
        self.assertEqual(image["Content-Type"], "image/png")
        self.assertIn("no-store", image["Cache-Control"])
        self.assertEqual(self.client.get("/api/captcha/refresh/").status_code, status.HTTP_404_NOT_FOUND)

    def test_missing_captcha_fields_are_rejected(self):
        response = self._register("missing-captcha")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("captcha_key", response.json())
        self.assertIn("captcha_code", response.json())

    def test_wrong_code_consumes_captcha(self):
        challenge = self._challenge()
        wrong = self._register("wrong-captcha", challenge["key"], "definitely-wrong")
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("验证码错误", str(wrong.json()["captcha_code"]))
        reused = self._register("wrong-captcha-retry", challenge["key"], "definitely-wrong")
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("验证码已失效", str(reused.json()["captcha_code"]))

    def test_correct_code_is_case_insensitive_and_single_use(self):
        store = CaptchaStore.objects.create(challenge="AbCd", response="AbCd")
        first = self._register("captcha-success", store.hashkey, "ABCD")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self._register("captcha-replay", store.hashkey, "abcd")
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("验证码已失效", str(second.json()["captcha_code"]))

    def test_expired_captcha_and_image_are_rejected(self):
        store = CaptchaStore.objects.create(challenge="old", response="old")
        store.expiration = timezone.now() - timedelta(seconds=1)
        store.save(update_fields=["expiration"])
        image = self.client.get(f"/api/auth/captcha/{store.hashkey}/image/")
        self.assertEqual(image.status_code, status.HTTP_410_GONE)
        response = self._register("expired-captcha", store.hashkey, "old")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("验证码已失效", str(response.json()["captcha_code"]))

    def test_scheduled_cleanup_removes_only_expired_captchas(self):
        from apps.goods.scheduler import _captcha_cleanup_tick

        expired = CaptchaStore.objects.create(challenge="old", response="old")
        expired.expiration = timezone.now() - timedelta(seconds=1)
        expired.save(update_fields=["expiration"])
        active = CaptchaStore.objects.create(challenge="new", response="new")
        _captcha_cleanup_tick()
        self.assertFalse(CaptchaStore.objects.filter(pk=expired.pk).exists())
        self.assertTrue(CaptchaStore.objects.filter(pk=active.pk).exists())

    @override_settings(REGISTER_CAPTCHA_ENABLED=False)
    def test_disabled_captcha_allows_registration(self):
        challenge = self._challenge()
        self.assertEqual(challenge, {"enabled": False, "key": None, "image": None})
        response = self._register("captcha-disabled")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_failed_registration_counts_toward_ip_throttle_even_with_different_users(self):
        role, _ = Role.objects.get_or_create(name="User")
        first_user = User.objects.create(username="throttle-user-1", role=role)
        second_user = User.objects.create(username="throttle-user-2", role=role)
        rates = {**settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], "auth_register": "1/hour"}
        rest_framework_settings = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
        with override_settings(REST_FRAMEWORK=rest_framework_settings), patch.object(
            RegisterRateThrottle, "THROTTLE_RATES", rates
        ):
            self.client.force_authenticate(first_user)
            first = self._register("rate-limited-1")
            self.client.force_authenticate(second_user)
            second = self._register("rate-limited-2")
        self.assertEqual(first.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class LoginThrottleTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_login_limits_same_ip_across_usernames(self):
        rates = {
            **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
            "auth_login": "1/minute",
            "auth_login_username": "100/minute",
        }
        rest_framework_settings = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
        with override_settings(REST_FRAMEWORK=rest_framework_settings), patch.object(
            LoginIPRateThrottle, "THROTTLE_RATES", rates
        ), patch.object(LoginUsernameRateThrottle, "THROTTLE_RATES", rates):
            first = self.client.post(
                "/api/auth/login/", {"username": "first", "password": "bad"},
                format="json", REMOTE_ADDR="192.0.2.10",
            )
            second = self.client.post(
                "/api/auth/login/", {"username": "second", "password": "bad"},
                format="json", REMOTE_ADDR="192.0.2.10",
            )
        self.assertEqual(first.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_login_limits_same_username_across_ips(self):
        rates = {
            **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
            "auth_login": "100/minute",
            "auth_login_username": "1/minute",
        }
        rest_framework_settings = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
        with override_settings(REST_FRAMEWORK=rest_framework_settings), patch.object(
            LoginIPRateThrottle, "THROTTLE_RATES", rates
        ), patch.object(LoginUsernameRateThrottle, "THROTTLE_RATES", rates):
            first = self.client.post(
                "/api/auth/login/", {"username": "TargetUser", "password": "bad"},
                format="json", REMOTE_ADDR="192.0.2.20",
            )
            second = self.client.post(
                "/api/auth/login/", {"username": " targetuser ", "password": "bad"},
                format="json", REMOTE_ADDR="192.0.2.21",
            )
        self.assertEqual(first.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


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
