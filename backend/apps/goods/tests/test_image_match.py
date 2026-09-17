import io
import math
import tempfile
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import numpy as np
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from PIL import Image, ImageDraw
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import Role, User

from ..image_match import (
    ImageFingerprint,
    ModelUnavailableError,
    QueryFeatures,
    decode_image,
    hamming_distance,
    refresh_goods_image_fingerprint,
)
from ..image_match.features import _detect_query_circle, _query_variants
from ..image_match.service import (
    _RankedFingerprint,
    _patch_similarity,
    _rerank_candidates,
)
from ..models import (
    Category,
    Goods,
    GoodsImageFingerprint,
    GoodsImageMatchAttempt,
    IP,
)


def _query_image(name="query.png") -> SimpleUploadedFile:
    output = io.BytesIO()
    Image.new("RGB", (96, 96), (220, 80, 110)).save(output, format="PNG")
    return SimpleUploadedFile(
        name,
        output.getvalue(),
        content_type="image/png",
    )


def _vector(primary_similarity: float) -> np.ndarray:
    vector = np.zeros(384, dtype=np.float32)
    vector[0] = primary_similarity
    vector[1] = math.sqrt(max(0.0, 1.0 - primary_similarity**2))
    return vector


def _embedding_bytes(vector: np.ndarray) -> bytes:
    return np.asarray(vector, dtype="<f4").tobytes()


class GoodsImageMatchApiTests(TestCase):
    def setUp(self):
        self.role = Role.objects.create(name="test-image-match-role")
        self.user = User.objects.create(
            username="image-match-user",
            password="unused",
            role=self.role,
            account_type=User.ACCOUNT_TYPE_COLLECTOR,
        )
        self.other_user = User.objects.create(
            username="image-match-other",
            password="unused",
            role=self.role,
            account_type=User.ACCOUNT_TYPE_COLLECTOR,
        )
        self.ip = IP.objects.create(name="测试作品")
        self.category = Category.objects.create(name="吧唧", path_name="周边/吧唧")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _goods(self, name, *, user=None, status_value=Goods._meta.get_field("status").default):
        return Goods.objects.create(
            user=user or self.user,
            name=name,
            ip=self.ip,
            category=self.category,
            main_photo=f"goods/main/{uuid4().hex}.jpg",
            status=status_value,
        )

    def _fingerprint(
        self,
        goods,
        *,
        phash="1111111111111111",
        similarity=0.90,
        source_name=None,
    ):
        return GoodsImageFingerprint.objects.create(
            goods=goods,
            phash=phash,
            embedding=_embedding_bytes(_vector(similarity)),
            embedding_dim=384,
            algorithm_version="dinov2-small-int8-v1",
            source_name=source_name or goods.main_photo.name,
        )

    @patch("apps.goods.image_match.service.extract_query_features")
    def test_hash_match_returns_direct_match(self, extract_query):
        goods = self._goods("主图完全一致")
        unrelated = self._goods("低分陪跑")
        self._fingerprint(goods, phash="0000000000000000", similarity=0.40)
        self._fingerprint(unrelated, phash="1111111111111111", similarity=0.50)
        extract_query.return_value = QueryFeatures(
            phash="0000000000000000",
            embeddings=np.stack([_vector(1.0), _vector(1.0)]),
        )

        response = self.client.post(
            reverse("goods-match-image"),
            {"image": _query_image()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["decision"], "matched")
        self.assertEqual(response.data["match"]["goods"]["id"], str(goods.pk))
        self.assertEqual(response.data["candidates"], [])
        self.assertIsNotNone(response.data["attempt_id"])
        attempt = GoodsImageMatchAttempt.objects.get()
        self.assertEqual(attempt.feedback, GoodsImageMatchAttempt.FEEDBACK_NONE)

    @patch("apps.goods.image_match.service.extract_query_features")
    def test_similar_image_returns_candidates(self, extract_query):
        goods = self._goods("相似候选")
        self._fingerprint(goods, phash="1111111111111111", similarity=0.90)
        extract_query.return_value = QueryFeatures(
            phash="ffffffffffffffff",
            embeddings=np.stack([_vector(1.0), _vector(1.0)]),
        )

        response = self.client.post(
            reverse("goods-match-image"),
            {"image": _query_image()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["decision"], "candidates")
        self.assertIsNone(response.data["match"])
        self.assertEqual(response.data["candidates"][0]["goods"]["id"], str(goods.pk))

    @patch("apps.goods.image_match.service.extract_query_features")
    def test_high_score_with_margin_returns_direct_match(self, extract_query):
        first = self._goods("第一候选")
        second = self._goods("第二候选")
        self._fingerprint(first, similarity=0.95)
        self._fingerprint(second, similarity=0.90)
        extract_query.return_value = QueryFeatures(
            phash="ffffffffffffffff",
            embeddings=np.stack([_vector(1.0), _vector(1.0)]),
        )

        response = self.client.post(
            reverse("goods-match-image"),
            {"image": _query_image()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["decision"], "matched")
        matched_id = response.data["match"]["goods"]["id"]
        self.assertIn(matched_id, {str(first.pk), str(second.pk)})

    @patch("apps.goods.image_match.service.extract_query_features")
    def test_low_score_returns_not_found(self, extract_query):
        goods = self._goods("不相似主图")
        self._fingerprint(goods, similarity=0.50)
        extract_query.return_value = QueryFeatures(
            phash="ffffffffffffffff",
            embeddings=np.stack([_vector(1.0), _vector(1.0)]),
        )

        response = self.client.post(
            reverse("goods-match-image"),
            {"image": _query_image()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["decision"], "not_found")
        self.assertEqual(response.data["candidates"], [])

    def test_status_scope_excludes_intended_and_draft(self):
        for index, status_value in enumerate(("intended", "draft", "sold")):
            goods = self._goods(f"范围外{index}", status_value=status_value)
            self._fingerprint(goods, phash="0000000000000000")

        response = self.client.post(
            reverse("goods-match-image"),
            {"image": _query_image()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["decision"], "not_found")

    @patch("apps.goods.image_match.service.extract_query_features")
    def test_other_user_index_is_invisible(self, extract_query):
        goods = self._goods("其他用户", user=self.other_user)
        self._fingerprint(goods, phash="0000000000000000")
        extract_query.return_value = QueryFeatures(
            phash="0000000000000000",
            embeddings=np.stack([_vector(1.0), _vector(1.0)]),
        )

        response = self.client.post(
            reverse("goods-match-image"),
            {"image": _query_image()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["decision"], "not_found")
        extract_query.assert_not_called()

    @patch("apps.goods.image_match.service.extract_query_features")
    def test_model_unavailable_returns_service_unavailable(self, extract_query):
        goods = self._goods("模型缺席")
        self._fingerprint(goods)
        extract_query.side_effect = ModelUnavailableError("模型尚未安装")

        response = self.client.post(
            reverse("goods-match-image"),
            {"image": _query_image()},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["code"], "goods_image_match_unavailable")

    def test_invalid_image_is_rejected(self):
        response = self.client.post(
            reverse("goods-match-image"),
            {
                "image": SimpleUploadedFile(
                    "bad.jpg",
                    b"not-an-image",
                    content_type="image/jpeg",
                )
            },
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch("apps.goods.image_match.service.extract_query_features")
    def test_feedback_confirms_candidate_and_is_idempotent(self, extract_query):
        goods = self._goods("反馈命中")
        self._fingerprint(goods, similarity=0.90)
        extract_query.return_value = QueryFeatures(
            phash="ffffffffffffffff",
            embeddings=np.stack([_vector(1.0), _vector(1.0)]),
        )
        match_response = self.client.post(
            reverse("goods-match-image"),
            {"image": _query_image()},
            format="multipart",
        )
        attempt_id = match_response.data["attempt_id"]

        payload = {
            "attempt_id": attempt_id,
            "outcome": "confirmed",
            "goods_id": str(goods.pk),
        }
        first = self.client.post(reverse("goods-match-feedback"), payload, format="json")
        second = self.client.post(reverse("goods-match-feedback"), payload, format="json")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        attempt = GoodsImageMatchAttempt.objects.get(pk=attempt_id)
        self.assertEqual(attempt.feedback, GoodsImageMatchAttempt.FEEDBACK_CONFIRMED)
        self.assertEqual(attempt.confirmed_goods_id, goods.pk)

    def test_feedback_rejects_goods_outside_candidates(self):
        goods = self._goods("未出现在候选")
        attempt = GoodsImageMatchAttempt.objects.create(
            user=self.user,
            decision=GoodsImageMatchAttempt.DECISION_NOT_FOUND,
            algorithm_version="dinov2-small-int8-v1",
            candidate_results=[],
        )
        response = self.client.post(
            reverse("goods-match-feedback"),
            {
                "attempt_id": str(attempt.pk),
                "outcome": "confirmed",
                "goods_id": str(goods.pk),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_club_account_cannot_use_match_endpoint(self):
        club = User.objects.create(
            username="image-match-club",
            password="unused",
            role=self.role,
            account_type=User.ACCOUNT_TYPE_CLUB,
        )
        self.client.force_authenticate(user=club)
        response = self.client.post(
            reverse("goods-match-image"),
            {"image": _query_image()},
            format="multipart",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ImageFeatureTests(TestCase):
    def test_phash_hamming_distance(self):
        self.assertEqual(hamming_distance("0000000000000000", "0000000000000000"), 0)
        self.assertEqual(hamming_distance("0000000000000000", "0000000000000003"), 2)

    def test_decode_rejects_corrupt_bytes(self):
        with self.assertRaisesMessage(Exception, "无法解码"):
            decode_image(b"not-an-image")

    def test_round_subject_adds_white_background_query_variant(self):
        image = Image.new("RGB", (320, 320), (35, 28, 20))
        draw = ImageDraw.Draw(image)
        draw.ellipse(
            (18, 12, 302, 296),
            fill=(245, 245, 240),
            outline=(255, 255, 255),
            width=4,
        )
        draw.ellipse((80, 80, 240, 240), fill=(180, 40, 90))
        draw.line((30, 160, 290, 160), fill=(20, 20, 20), width=6)

        circle = _detect_query_circle(image)
        names, variants = _query_variants(image)

        self.assertIsNotNone(circle)
        self.assertIn("circle_white", names)
        self.assertEqual(len(variants), len(names))

    def test_patch_similarity_and_rerank_promote_fine_grained_match(self):
        query_patch = np.stack(
            [
                np.pad(np.array([1.0, 0.0], dtype=np.float32), (0, 382)),
                np.pad(np.array([0.0, 1.0], dtype=np.float32), (0, 382)),
            ]
        )
        target_patch = query_patch.copy()
        rival_patch = np.stack(
            [
                np.asarray([0.9, math.sqrt(1 - 0.9**2)], dtype=np.float32),
                np.asarray([0.0, 1.0], dtype=np.float32),
            ]
        )
        rival_patch = np.pad(rival_patch, ((0, 0), (0, 382)))
        self.assertGreater(
            _patch_similarity(query_patch, target_patch, top_k=2),
            _patch_similarity(query_patch, rival_patch, top_k=2),
        )

        class FakePhoto:
            def __init__(self, name):
                self.name = name

            def open(self, mode):
                return io.BytesIO(b"image")

        class FakeEngine:
            def embed_tokens(self, images):
                return None, np.stack(
                    [rival_patch, target_patch],
                )

        target = _RankedFingerprint(
            fingerprint=SimpleNamespace(
                goods=SimpleNamespace(
                    main_photo=FakePhoto("target.jpg"),
                ),
                goods_id="target",
            ),
            score=0.83,
            phash_distance=20,
            best_variant_index=0,
            coarse_score=0.83,
        )
        rival = _RankedFingerprint(
            fingerprint=SimpleNamespace(
                goods=SimpleNamespace(
                    main_photo=FakePhoto("rival.jpg"),
                ),
                goods_id="rival",
            ),
            score=0.842,
            phash_distance=20,
            best_variant_index=0,
            coarse_score=0.842,
        )
        query = QueryFeatures(
            phash="ffffffffffffffff",
            embeddings=np.stack([_vector(1.0)]),
            patch_embeddings=(query_patch,),
            variant_names=("circle_white",),
        )

        with (
            patch(
                "apps.goods.image_match.service.decode_image",
                return_value=Image.new("RGB", (64, 64), (240, 240, 240)),
            ),
            patch(
                "apps.goods.image_match.service._get_engine",
                return_value=FakeEngine(),
            ),
        ):
            reranked = _rerank_candidates(query, [rival, target])

        self.assertEqual(reranked[0].fingerprint.goods_id, "target")


class GoodsImageIndexingTests(TestCase):
    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.override.enable()
        self.role = Role.objects.create(name="index-role")
        self.user = User.objects.create(
            username="index-user",
            password="unused",
            role=self.role,
        )
        self.ip = IP.objects.create(name="索引作品")
        self.category = Category.objects.create(name="立牌")

    def tearDown(self):
        self.override.disable()
        self.media_dir.cleanup()

    @patch("apps.goods.image_match.indexing.extract_main_fingerprint")
    def test_refresh_creates_updates_and_deletes_fingerprint(self, extract):
        extract.return_value = ImageFingerprint(
            phash="1234567890abcdef",
            embedding=_vector(1.0),
        )
        goods = Goods.objects.create(
            user=self.user,
            name="索引谷子",
            ip=self.ip,
            category=self.category,
            main_photo=_query_image("main.png"),
        )

        self.assertTrue(refresh_goods_image_fingerprint(goods, force=True))
        fingerprint = GoodsImageFingerprint.objects.get(goods=goods)
        self.assertEqual(fingerprint.phash, "1234567890abcdef")
        self.assertEqual(fingerprint.embedding_dim, 384)

        extract.return_value = ImageFingerprint(
            phash="fedcba0987654321",
            embedding=_vector(0.8),
        )
        goods.main_photo = _query_image("replacement.png")
        goods.save(update_fields=["main_photo", "updated_at"])
        self.assertTrue(refresh_goods_image_fingerprint(goods, force=True))
        fingerprint.refresh_from_db()
        self.assertEqual(fingerprint.phash, "fedcba0987654321")

        goods.main_photo.delete(save=False)
        goods.main_photo = None
        goods.save(update_fields=["main_photo", "updated_at"])
        self.assertFalse(refresh_goods_image_fingerprint(goods))
        self.assertFalse(GoodsImageFingerprint.objects.filter(goods=goods).exists())

    @patch("apps.goods.image_match.indexing.extract_main_fingerprint")
    def test_rebuild_indexes_all_goods_statuses(self, extract):
        extract.return_value = ImageFingerprint(
            phash="1234567890abcdef",
            embedding=_vector(1.0),
        )
        statuses = ("draft", "intended", "in_cabinet", "outdoor", "sold")
        for index, status_value in enumerate(statuses):
            Goods.objects.create(
                user=self.user,
                name=f"全状态索引-{status_value}",
                ip=self.ip,
                category=self.category,
                status=status_value,
                main_photo=_query_image(f"status-{index}.png"),
            )

        call_command("rebuild_goods_image_index", verbosity=0)

        fingerprint_statuses = set(
            GoodsImageFingerprint.objects.values_list("goods__status", flat=True)
        )
        self.assertEqual(fingerprint_statuses, set(statuses))


class GoodsImageAutoIndexTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.media_dir.name)
        self.override.enable()
        self.role = Role.objects.create(name="auto-index-role")
        self.user = User.objects.create(
            username="auto-index-user",
            password="unused",
            role=self.role,
        )
        self.ip = IP.objects.create(name="自动索引作品")
        self.category = Category.objects.create(name="自动索引品类")

    def tearDown(self):
        self.override.disable()
        self.media_dir.cleanup()

    @patch("apps.goods.image_match.indexing.extract_main_fingerprint")
    def test_new_goods_with_main_photo_is_indexed_on_commit(self, extract):
        extract.return_value = ImageFingerprint(
            phash="0123456789abcdef",
            embedding=_vector(1.0),
        )

        goods = Goods.objects.create(
            user=self.user,
            name="新增后自动索引",
            ip=self.ip,
            category=self.category,
            main_photo=_query_image("auto-index.png"),
        )

        fingerprint = GoodsImageFingerprint.objects.get(goods=goods)
        self.assertEqual(fingerprint.phash, "0123456789abcdef")
        self.assertEqual(fingerprint.source_name, goods.main_photo.name)


class GoodsImageMatchPruneTests(TestCase):
    def test_prune_removes_only_expired_attempt_metadata(self):
        role = Role.objects.create(name="prune-role")
        user = User.objects.create(username="prune-user", password="unused", role=role)
        expired = GoodsImageMatchAttempt.objects.create(
            user=user,
            decision=GoodsImageMatchAttempt.DECISION_NOT_FOUND,
            algorithm_version="dinov2-small-int8-v1",
        )
        recent = GoodsImageMatchAttempt.objects.create(
            user=user,
            decision=GoodsImageMatchAttempt.DECISION_NOT_FOUND,
            algorithm_version="dinov2-small-int8-v1",
        )
        GoodsImageMatchAttempt.objects.filter(pk=expired.pk).update(
            created_at=timezone.now() - timedelta(days=181)
        )

        call_command("prune_goods_match_attempts", days=180, verbosity=0)

        self.assertFalse(GoodsImageMatchAttempt.objects.filter(pk=expired.pk).exists())
        self.assertTrue(GoodsImageMatchAttempt.objects.filter(pk=recent.pk).exists())
