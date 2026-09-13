import os
import tempfile
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from captcha.models import CaptchaStore
from django.conf import settings
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
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
    """GET/PATCH /api/auth/me/"""

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

    def test_update_username_requires_current_password(self):
        self.client.force_authenticate(user=self.user)
        wrong = self.client.patch(
            "/api/auth/me/",
            {"username": "renamed", "current_password": "wrong"},
            format="json",
        )
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "meuser")

        updated = self.client.patch(
            "/api/auth/me/",
            {"username": "renamed", "current_password": "pass123"},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.json()["username"], "renamed")
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "renamed")

    def test_update_rejects_duplicate_username(self):
        User.objects.create(username="occupied", role=self.role)
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            "/api/auth/me/",
            {"username": "occupied", "current_password": "pass123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.json())

    def test_update_password_keeps_current_session_valid(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(
            "/api/auth/me/",
            {"current_password": "pass123", "new_password": "newpass456"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertFalse(self.user.check_password("pass123"))
        self.assertTrue(self.user.check_password("newpass456"))
        self.assertEqual(self.client.get("/api/auth/me/").status_code, status.HTTP_200_OK)

    def test_update_rejects_no_changes_and_unauthenticated_request(self):
        self.client.force_authenticate(user=self.user)
        unchanged = self.client.patch(
            "/api/auth/me/",
            {"username": "meuser", "current_password": "pass123"},
            format="json",
        )
        self.assertEqual(unchanged.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(user=None)
        unauthenticated = self.client.patch(
            "/api/auth/me/",
            {"username": "renamed", "current_password": "pass123"},
            format="json",
        )
        self.assertIn(unauthenticated.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_club_account_can_update_username_and_password(self):
        club_user = User.objects.create(
            username="club-account",
            role=self.role,
            account_type=User.ACCOUNT_TYPE_CLUB,
        )
        club_user.set_password("pass123")
        club_user.save()
        self.client.force_authenticate(user=club_user)

        response = self.client.patch(
            "/api/auth/me/",
            {
                "username": "club-renamed",
                "current_password": "pass123",
                "new_password": "clubpass456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["username"], "club-renamed")
        self.assertEqual(response.json()["account_type"], User.ACCOUNT_TYPE_CLUB)
        club_user.refresh_from_db()
        self.assertEqual(club_user.username, "club-renamed")
        self.assertFalse(club_user.check_password("pass123"))
        self.assertTrue(club_user.check_password("clubpass456"))


class UserAvatarViewTestCase(TestCase):
    """POST/DELETE /api/auth/me/avatar/"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="avatar-user", role=self.role)
        self.user.set_password("pass123")
        self.user.save()
        self.media_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.media_dir.cleanup)
        self.media_override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.media_override.enable()
        self.addCleanup(self.media_override.disable)

    def image_file(self, name="avatar.png", size=(32, 32), image_format="PNG"):
        data = BytesIO()
        Image.new("RGB", size, color="#d4af37").save(data, format=image_format)
        data.seek(0)
        content_type = "image/png" if image_format == "PNG" else f"image/{image_format.lower()}"
        return SimpleUploadedFile(name, data.read(), content_type=content_type)

    def test_me_returns_null_avatar_without_upload(self):
        self.client.force_authenticate(self.user)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.json()["avatar"])

    def test_upload_replace_and_delete_avatar_cleans_old_files(self):
        self.client.force_authenticate(self.user)
        first = self.client.post(
            "/api/auth/me/avatar/",
            {"avatar": self.image_file("first.png")},
            format="multipart",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertIn("/media/users/avatars/first", first.json()["avatar"])
        self.user.refresh_from_db()
        first_name = self.user.avatar.name
        first_path = self.user.avatar.path

        second = self.client.post(
            "/api/auth/me/avatar/",
            {"avatar": self.image_file("second.png")},
            format="multipart",
        )
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(os.path.exists(first_path))
        self.user.refresh_from_db()
        second_path = self.user.avatar.path
        self.assertNotEqual(first_name, self.user.avatar.name)
        self.assertTrue(os.path.exists(second_path))

        removed = self.client.delete("/api/auth/me/avatar/")
        self.assertEqual(removed.status_code, status.HTTP_200_OK)
        self.assertIsNone(removed.json()["avatar"])
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)
        self.assertFalse(os.path.exists(second_path))

    def test_upload_rejects_invalid_and_oversized_files(self):
        self.client.force_authenticate(self.user)
        invalid = self.client.post(
            "/api/auth/me/avatar/",
            {"avatar": SimpleUploadedFile("avatar.txt", b"not-an-image", content_type="text/plain")},
            format="multipart",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

        large = self.client.post(
            "/api/auth/me/avatar/",
            {"avatar": self.image_file("large.bmp", size=(2500, 2500), image_format="BMP")},
            format="multipart",
        )
        self.assertEqual(large.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("5MB", str(large.json()))

    def test_admin_can_upload_personal_avatar(self):
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        admin = User.objects.create(username="avatar-admin", role=admin_role)
        self.client.force_authenticate(admin)

        response = self.client.post(
            "/api/auth/me/avatar/",
            {"avatar": self.image_file("admin.png")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("/media/users/avatars/admin", response.json()["avatar"])

    def test_club_account_cannot_use_personal_avatar_endpoints(self):
        club_user = User.objects.create(
            username="club-avatar-user",
            role=self.role,
            account_type=User.ACCOUNT_TYPE_CLUB,
        )
        self.client.force_authenticate(club_user)
        upload = self.client.post(
            "/api/auth/me/avatar/",
            {"avatar": self.image_file()},
            format="multipart",
        )
        removed = self.client.delete("/api/auth/me/avatar/")
        self.assertEqual(upload.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(removed.status_code, status.HTTP_403_FORBIDDEN)

    def test_avatar_endpoints_require_authentication(self):
        upload = self.client.post(
            "/api/auth/me/avatar/",
            {"avatar": self.image_file()},
            format="multipart",
        )
        removed = self.client.delete("/api/auth/me/avatar/")
        self.assertIn(upload.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
        self.assertIn(removed.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


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
