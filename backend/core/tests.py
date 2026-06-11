from unittest.mock import MagicMock

from django.test import TestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed

from apps.users.models import Role, User
from .authentication import JWTAuthentication
from .jwt import (
    JWTError,
    _b64url_decode,
    _b64url_encode,
    build_access_payload,
    decode_hs256,
    encode_hs256,
)
from .permissions import IsAdmin, IsAdminOrReadOnly, IsOwnerOnly, IsOwnerOrPublicReadOnly, is_admin


SECRET = "test-secret-key"


# ─── JWT encode / decode ─────────────────────────────────────────────


class JWTEncodeDecodeTestCase(TestCase):
    """core.jwt — encode_hs256 / decode_hs256 基本对称性"""

    def test_encode_decode_roundtrip(self):
        payload = {"user_id": 42, "iat": 1000, "exp": 9999999999}
        token = encode_hs256(payload, SECRET)
        decoded = decode_hs256(token, SECRET)
        self.assertEqual(decoded["user_id"], 42)
        self.assertEqual(decoded["iat"], 1000)
        self.assertEqual(decoded["exp"], 9999999999)

    def test_token_has_three_parts(self):
        token = encode_hs256({"user_id": 1, "exp": 9999999999}, SECRET)
        parts = token.split(".")
        self.assertEqual(len(parts), 3)

    def test_decode_tampered_signature_raises_bad_signature(self):
        token = encode_hs256({"user_id": 1, "exp": 9999999999}, SECRET)
        header, payload, sig = token.split(".")
        tampered = f"{header}.{payload}.{sig[:-2]}AA"
        with self.assertRaises(JWTError) as ctx:
            decode_hs256(tampered, SECRET)
        self.assertEqual(str(ctx.exception), "bad_signature")

    def test_decode_expired_token_raises_token_expired(self):
        payload = {"user_id": 1, "iat": 1000, "exp": 1001}
        token = encode_hs256(payload, SECRET)
        with self.assertRaises(JWTError) as ctx:
            decode_hs256(token, SECRET)
        self.assertEqual(str(ctx.exception), "token_expired")

    def test_decode_malformed_token_raises_invalid_token(self):
        with self.assertRaises(JWTError) as ctx:
            decode_hs256("not.a.valid.token.here", SECRET)
        self.assertEqual(str(ctx.exception), "invalid_token")

    def test_decode_two_part_token_raises_invalid_token(self):
        with self.assertRaises(JWTError):
            decode_hs256("only.two", SECRET)

    def test_decode_bad_payload_json_raises_bad_payload(self):
        import base64
        header = _b64url_encode(b'{"alg":"HS256","typ":"JWT"}')
        bad_payload = _b64url_encode(b"not-json!!!")
        # build a valid signature over the bad content so we reach the json.loads step
        import hmac, hashlib
        signing_input = f"{header}.{bad_payload}".encode("ascii")
        sig = hmac.new(SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        sig_b64 = _b64url_encode(sig)
        token = f"{header}.{bad_payload}.{sig_b64}"
        with self.assertRaises(JWTError) as ctx:
            decode_hs256(token, SECRET)
        self.assertEqual(str(ctx.exception), "bad_payload")

    def test_decode_no_exp_field_is_ok(self):
        """没有 exp 字段的 token 应当正常解码"""
        payload = {"user_id": 7}
        token = encode_hs256(payload, SECRET)
        decoded = decode_hs256(token, SECRET)
        self.assertEqual(decoded["user_id"], 7)

    def test_wrong_secret_raises_bad_signature(self):
        token = encode_hs256({"user_id": 1, "exp": 9999999999}, SECRET)
        with self.assertRaises(JWTError) as ctx:
            decode_hs256(token, "wrong-secret")
        self.assertEqual(str(ctx.exception), "bad_signature")


class BuildAccessPayloadTestCase(TestCase):
    """core.jwt — build_access_payload"""

    def test_payload_contains_required_fields(self):
        payload = build_access_payload(user_id=42, ttl_seconds=3600)
        self.assertEqual(payload["user_id"], 42)
        self.assertIn("iat", payload)
        self.assertIn("exp", payload)
        self.assertEqual(payload["exp"] - payload["iat"], 3600)

    def test_iat_is_current_time(self):
        import time
        before = int(time.time())
        payload = build_access_payload(user_id=1, ttl_seconds=600)
        after = int(time.time())
        self.assertGreaterEqual(payload["iat"], before)
        self.assertLessEqual(payload["iat"], after)


class Base64UrlTestCase(TestCase):
    """core.jwt — _b64url_encode / _b64url_decode 对称性"""

    def test_roundtrip(self):
        data = b"hello world! \xe4\xb8\xad\xe6\x96\x87"
        encoded = _b64url_encode(data)
        decoded = _b64url_decode(encoded)
        self.assertEqual(decoded, data)

    def test_no_padding_chars(self):
        """base64url 编码不应包含 = 填充"""
        encoded = _b64url_encode(b"a")
        self.assertNotIn("=", encoded)

    def test_empty_bytes(self):
        self.assertEqual(_b64url_decode(_b64url_encode(b"")), b"")


# ─── JWTAuthentication ────────────────────────────────────────────────


@override_settings(JWT_SECRET=SECRET)
class JWTAuthenticationTestCase(TestCase):
    """core.authentication — JWTAuthentication.authenticate"""

    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(
            username="authuser", role=self.role, is_active=True
        )
        self.user.set_password("pass123")
        self.user.save()
        self.auth = JWTAuthentication()

    def _make_request(self, header_value=None):
        request = MagicMock()
        if header_value is not None:
            request.headers = {"Authorization": header_value}
        else:
            request.headers = {}
        return request

    def test_no_auth_header_returns_none(self):
        request = self._make_request(None)
        result = self.auth.authenticate(request)
        self.assertIsNone(result)

    def test_valid_bearer_token_returns_user(self):
        token = encode_hs256(
            {"user_id": self.user.id, "exp": 9999999999}, SECRET
        )
        request = self._make_request(f"Bearer {token}")
        user, tok = self.auth.authenticate(request)
        self.assertEqual(user.id, self.user.id)
        self.assertEqual(tok, token)

    def test_non_bearer_prefix_returns_none(self):
        request = self._make_request("Basic sometoken")
        result = self.auth.authenticate(request)
        self.assertIsNone(result)

    def test_malformed_header_raises(self):
        request = self._make_request("Bearer token extra parts")
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_empty_token_raises(self):
        request = self._make_request("Bearer ")
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_invalid_token_raises(self):
        request = self._make_request("Bearer invalid.token.value")
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_nonexistent_user_raises(self):
        token = encode_hs256({"user_id": 99999, "exp": 9999999999}, SECRET)
        request = self._make_request(f"Bearer {token}")
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_inactive_user_raises(self):
        self.user.is_active = False
        self.user.save()
        token = encode_hs256(
            {"user_id": self.user.id, "exp": 9999999999}, SECRET
        )
        request = self._make_request(f"Bearer {token}")
        with self.assertRaises(AuthenticationFailed):
            self.auth.authenticate(request)


# ─── Permission classes ──────────────────────────────────────────────


class IsAdminHelperTestCase(TestCase):
    """core.permissions — is_admin() 函数"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")

    def test_admin_role_returns_true(self):
        user = User(username="admin", role=self.admin_role)
        self.assertTrue(is_admin(user))

    def test_user_role_returns_false(self):
        user = User(username="user", role=self.user_role)
        self.assertFalse(is_admin(user))

    def test_no_role_returns_false(self):
        user = MagicMock()
        user.role = None
        self.assertFalse(is_admin(user))

    def test_case_insensitive(self):
        role, _ = Role.objects.get_or_create(name="ADMIN")
        user = User(username="a", role=role)
        self.assertTrue(is_admin(user))


class IsAdminPermissionTestCase(TestCase):
    """core.permissions — IsAdmin"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.view = MagicMock()

    def _request(self, user):
        req = MagicMock()
        req.user = user
        return req

    def test_admin_passes(self):
        user = User(username="admin", role=self.admin_role)
        self.assertTrue(IsAdmin().has_permission(self._request(user), self.view))

    def test_normal_user_denied(self):
        user = User(username="u", role=self.user_role)
        self.assertFalse(IsAdmin().has_permission(self._request(user), self.view))

    def test_unauthenticated_denied(self):
        user = MagicMock()
        user.is_authenticated = False
        self.assertFalse(IsAdmin().has_permission(self._request(user), self.view))


class IsAdminOrReadOnlyTestCase(TestCase):
    """core.permissions — IsAdminOrReadOnly"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.view = MagicMock()

    def _request(self, user, method="GET"):
        req = MagicMock()
        req.user = user
        req.method = method
        return req

    def test_get_allowed_for_normal_user(self):
        user = User(username="u", role=self.user_role)
        self.assertTrue(
            IsAdminOrReadOnly().has_permission(self._request(user, "GET"), self.view)
        )

    def test_post_denied_for_normal_user(self):
        user = User(username="u", role=self.user_role)
        self.assertFalse(
            IsAdminOrReadOnly().has_permission(self._request(user, "POST"), self.view)
        )

    def test_post_allowed_for_admin(self):
        user = User(username="admin", role=self.admin_role)
        self.assertTrue(
            IsAdminOrReadOnly().has_permission(self._request(user, "POST"), self.view)
        )

    def test_delete_allowed_for_admin(self):
        user = User(username="admin", role=self.admin_role)
        self.assertTrue(
            IsAdminOrReadOnly().has_permission(self._request(user, "DELETE"), self.view)
        )


class IsOwnerOnlyTestCase(TestCase):
    """core.permissions — IsOwnerOnly"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.view = MagicMock()

    def _request(self, user, method="GET"):
        req = MagicMock()
        req.user = user
        req.method = method
        return req

    def test_owner_passes(self):
        user = User(id=1, username="owner", role=self.user_role)
        obj = MagicMock()
        obj.user_id = 1
        self.assertTrue(
            IsOwnerOnly().has_object_permission(self._request(user), self.view, obj)
        )

    def test_non_owner_denied(self):
        user = User(id=1, username="owner", role=self.user_role)
        obj = MagicMock()
        obj.user_id = 2
        self.assertFalse(
            IsOwnerOnly().has_object_permission(self._request(user), self.view, obj)
        )

    def test_admin_always_passes(self):
        user = User(id=99, username="admin", role=self.admin_role)
        obj = MagicMock()
        obj.user_id = 1
        self.assertTrue(
            IsOwnerOnly().has_object_permission(self._request(user), self.view, obj)
        )


class IsOwnerOrPublicReadOnlyTestCase(TestCase):
    """core.permissions — IsOwnerOrPublicReadOnly"""

    def setUp(self):
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.view = MagicMock()

    def _request(self, user, method="GET"):
        req = MagicMock()
        req.user = user
        req.method = method
        return req

    def test_public_object_readable_by_non_owner(self):
        user = User(id=2, username="other", role=self.user_role)
        obj = MagicMock()
        obj.user_id = 1
        obj.is_public = True
        self.assertTrue(
            IsOwnerOrPublicReadOnly().has_object_permission(
                self._request(user, "GET"), self.view, obj
            )
        )

    def test_private_object_not_readable_by_non_owner(self):
        user = User(id=2, username="other", role=self.user_role)
        obj = MagicMock()
        obj.user_id = 1
        obj.is_public = False
        self.assertFalse(
            IsOwnerOrPublicReadOnly().has_object_permission(
                self._request(user, "GET"), self.view, obj
            )
        )

    def test_owner_can_write(self):
        user = User(id=1, username="owner", role=self.user_role)
        obj = MagicMock()
        obj.user_id = 1
        obj.is_public = False
        self.assertTrue(
            IsOwnerOrPublicReadOnly().has_object_permission(
                self._request(user, "PUT"), self.view, obj
            )
        )

    def test_non_owner_cannot_write(self):
        user = User(id=2, username="other", role=self.user_role)
        obj = MagicMock()
        obj.user_id = 1
        obj.is_public = True  # public but still can't write
        self.assertFalse(
            IsOwnerOrPublicReadOnly().has_object_permission(
                self._request(user, "PUT"), self.view, obj
            )
        )

    def test_admin_bypasses_all(self):
        user = User(id=99, username="admin", role=self.admin_role)
        obj = MagicMock()
        obj.user_id = 1
        obj.is_public = False
        self.assertTrue(
            IsOwnerOrPublicReadOnly().has_object_permission(
                self._request(user, "DELETE"), self.view, obj
            )
        )
