from django.core.cache import cache
from django.test import TestCase, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date, timedelta
from decimal import Decimal
import io

import numpy as np

from PIL import Image, ImageDraw
from django.utils import timezone

from apps.users.models import User, Role
from ..models import Goods, GoodsImageFingerprint, IP, Character, Category, Theme, ThemeImage
from apps.location.models import StorageNode
from ..similarity import (
    GoodsSimilarityCalculator,
    ImageSimilarityIndex,
    SeedSelector,
    SimilarityGroupBuilder,
)
from ..utils import compress_image


def _similarity_vector(similarity):
    vector = np.zeros(384, dtype=np.float32)
    vector[0] = similarity
    vector[1] = np.sqrt(max(0.0, 1.0 - similarity ** 2))
    return vector


def _embedding_bytes(vector):
    return np.asarray(vector, dtype="<f4").tobytes()


class SimilarityAlgorithmTestCase(TestCase):
    """测试相似度算法"""

    def setUp(self):
        """设置测试数据"""
        # 创建角色和用户
        self.role = Role.objects.create(name='测试角色')
        self.user = User.objects.create(
            username='testuser',
            password='testpass123',
            role=self.role
        )

        # 创建IP
        self.ip1 = IP.objects.create(name='崩坏：星穹铁道', subject_type=4)
        self.ip2 = IP.objects.create(name='原神', subject_type=4)

        # 创建角色
        self.char1 = Character.objects.create(ip=self.ip1, name='流萤', gender='female')
        self.char2 = Character.objects.create(ip=self.ip1, name='花火', gender='female')
        self.char3 = Character.objects.create(ip=self.ip2, name='纳西妲', gender='female')

        # 创建品类
        self.cat_root = Category.objects.create(name='周边', path_name='周边')
        self.cat_badge = Category.objects.create(
            name='吧唧',
            parent=self.cat_root,
            path_name='周边/吧唧'
        )

        # 创建主题
        self.theme1 = Theme.objects.create(user=self.user, name='夏日主题')

        # 创建谷子
        self.goods1 = Goods.objects.create(
            user=self.user,
            name='流萤立牌',
            ip=self.ip1,
            category=self.cat_badge,
            theme=self.theme1,
            price=Decimal('50.00'),
            purchase_date=date(2024, 1, 15)
        )
        self.goods1.characters.add(self.char1)

        self.goods2 = Goods.objects.create(
            user=self.user,
            name='花火吧唧',
            ip=self.ip1,
            category=self.cat_badge,
            theme=self.theme1,
            price=Decimal('55.00'),
            purchase_date=date(2024, 1, 20)
        )
        self.goods2.characters.add(self.char2)

        self.goods3 = Goods.objects.create(
            user=self.user,
            name='纳西妲吧唧',
            ip=self.ip2,
            category=self.cat_badge,
            price=Decimal('200.00'),
            purchase_date=date(2024, 6, 1)
        )
        self.goods3.characters.add(self.char3)

        self.calculator = GoodsSimilarityCalculator()

    def _attach_fingerprint(
        self,
        goods,
        *,
        phash="1111111111111111",
        similarity=0.8,
        source_name=None,
        embedding=None,
        embedding_dim=384,
        algorithm_version="dinov2-small-int8-v1",
    ):
        main_photo = source_name or f"goods/main/{goods.id}.jpg"
        Goods.objects.filter(pk=goods.pk).update(main_photo=main_photo)
        goods.refresh_from_db(fields=["main_photo"])
        return GoodsImageFingerprint.objects.create(
            goods=goods,
            phash=phash,
            embedding=(
                _embedding_bytes(_similarity_vector(similarity))
                if embedding is None
                else embedding
            ),
            embedding_dim=embedding_dim,
            algorithm_version=algorithm_version,
            source_name=source_name or goods.main_photo.name,
        )

    def test_ip_match_same_ip(self):
        """测试相同IP的评分"""
        score = self.calculator._score_ip_match(self.goods1, self.goods2)
        self.assertEqual(score, 30.0)

    def test_ip_match_same_subject_type(self):
        """测试相同作品类型的评分"""
        score = self.calculator._score_ip_match(self.goods1, self.goods3)
        self.assertAlmostEqual(score, 9.9, places=1)

    def test_character_overlap(self):
        """测试角色重叠评分"""
        # 创建一个同时有流萤和花火的谷子
        goods_both = Goods.objects.create(
            user=self.user,
            name='双人立牌',
            ip=self.ip1,
            category=self.cat_badge
        )
        goods_both.characters.add(self.char1, self.char2)

        score = self.calculator._score_character_overlap(self.goods1, goods_both)
        # goods1有1个角色，goods_both有2个角色，共享1个
        # (1 / 2) * 23 = 11.5
        self.assertAlmostEqual(score, 11.5, places=1)

    def test_category_hierarchy_same_category(self):
        """测试相同品类的评分"""
        score = self.calculator._score_category_hierarchy(self.goods1, self.goods2)
        self.assertEqual(score, 18.0)

    def test_theme_match(self):
        """测试主题匹配评分"""
        score = self.calculator._score_theme_match(self.goods1, self.goods2)
        self.assertEqual(score, 15.0)

    def test_price_range_similar(self):
        """测试相似价格的评分"""
        score = self.calculator._score_price_range(self.goods1, self.goods2)
        # 50和55差异约10%
        self.assertGreater(score, 5.0)

    def test_purchase_proximity_same_month(self):
        """测试同月入手的评分"""
        score = self.calculator._score_purchase_proximity(self.goods1, self.goods2)
        # 1月15日和1月20日，同月
        self.assertEqual(score, 6.0)

    def test_calculate_similarity_high(self):
        """测试高相似度计算"""
        score = self.calculator.calculate_similarity(self.goods1, self.goods2)
        # 相同IP(30) + 相同品类(18) + 相同主题(15) + 相似价格(~5) + 同月(6) = ~74
        self.assertGreater(score, 60.0)

    def test_calculate_similarity_low(self):
        """测试低相似度计算"""
        score = self.calculator.calculate_similarity(self.goods1, self.goods3)
        # 不同IP但同类型(10) + 相同品类(18) = 28
        self.assertLess(score, 40.0)

    def test_image_similarity_is_fused_with_metadata(self):
        """有主图指纹时，元数据与余弦分数按 75/25 融合。"""
        self._attach_fingerprint(
            self.goods1,
            phash="0000000000000000",
            similarity=1.0,
        )
        self._attach_fingerprint(
            self.goods2,
            phash="ffffffffffffffff",
            similarity=0.8,
        )

        metadata_score = self.calculator.calculate_metadata_similarity(
            self.goods1,
            self.goods2,
        )
        image_index = ImageSimilarityIndex.from_goods([self.goods1, self.goods2])
        fused = GoodsSimilarityCalculator(image_index=image_index).calculate_similarity(
            self.goods1,
            self.goods2,
        )

        self.assertAlmostEqual(
            fused,
            metadata_score * 0.75 + 0.8 * 25,
            places=6,
        )

    def test_negative_image_similarity_is_clamped_to_zero(self):
        positive = np.zeros(384, dtype=np.float32)
        positive[0] = 1.0
        negative = -positive
        self._attach_fingerprint(
            self.goods1,
            phash="0000000000000000",
            embedding=_embedding_bytes(positive),
        )
        self._attach_fingerprint(
            self.goods2,
            phash="ffffffffffffffff",
            embedding=_embedding_bytes(negative),
        )

        metadata_score = self.calculator.calculate_metadata_similarity(
            self.goods1,
            self.goods2,
        )
        image_index = ImageSimilarityIndex.from_goods([self.goods1, self.goods2])
        fused = GoodsSimilarityCalculator(image_index=image_index).calculate_similarity(
            self.goods1,
            self.goods2,
        )

        self.assertAlmostEqual(fused, metadata_score * 0.75, places=6)

    def test_missing_or_corrupt_fingerprint_uses_metadata_score(self):
        """缺图或损坏向量时不惩罚，直接使用原始元数据总分。"""
        metadata_score = self.calculator.calculate_metadata_similarity(
            self.goods1,
            self.goods2,
        )
        self.assertEqual(
            self.calculator.calculate_similarity(self.goods1, self.goods2),
            metadata_score,
        )

        self._attach_fingerprint(
            self.goods1,
            phash="0000000000000000",
            embedding=b"\x00\x00\x00\x00",
            embedding_dim=384,
        )
        self._attach_fingerprint(
            self.goods2,
            phash="ffffffffffffffff",
            embedding=b"\x00\x00\x00\x00",
            embedding_dim=384,
        )
        image_index = ImageSimilarityIndex.from_goods([self.goods1, self.goods2])
        fused = GoodsSimilarityCalculator(image_index=image_index).calculate_similarity(
            self.goods1,
            self.goods2,
        )
        self.assertAlmostEqual(fused, metadata_score, places=6)

    def test_stale_fingerprint_source_is_ignored(self):
        self._attach_fingerprint(
            self.goods1,
            source_name="goods/main/old-one.jpg",
        )
        Goods.objects.filter(pk=self.goods1.pk).update(
            main_photo="goods/main/new-one.jpg"
        )
        self.goods1.refresh_from_db(fields=["main_photo"])
        self._attach_fingerprint(
            self.goods2,
            source_name="goods/main/old-two.jpg",
        )
        Goods.objects.filter(pk=self.goods2.pk).update(
            main_photo="goods/main/new-two.jpg"
        )
        self.goods2.refresh_from_db(fields=["main_photo"])

        metadata_score = self.calculator.calculate_metadata_similarity(
            self.goods1,
            self.goods2,
        )
        image_index = ImageSimilarityIndex.from_goods([self.goods1, self.goods2])
        fused = GoodsSimilarityCalculator(image_index=image_index).calculate_similarity(
            self.goods1,
            self.goods2,
        )
        self.assertEqual(fused, metadata_score)

    def test_old_fingerprint_algorithm_version_is_ignored(self):
        self._attach_fingerprint(
            self.goods1,
            algorithm_version="old-algorithm",
        )
        self._attach_fingerprint(
            self.goods2,
            algorithm_version="old-algorithm",
        )

        metadata_score = self.calculator.calculate_metadata_similarity(
            self.goods1,
            self.goods2,
        )
        image_index = ImageSimilarityIndex.from_goods([self.goods1, self.goods2])
        fused = GoodsSimilarityCalculator(image_index=image_index).calculate_similarity(
            self.goods1,
            self.goods2,
        )
        self.assertEqual(fused, metadata_score)

    def test_phash_match_marks_pair_as_same_image(self):
        self._attach_fingerprint(
            self.goods1,
            phash="1234567890abcdef",
            similarity=0.1,
        )
        self._attach_fingerprint(
            self.goods2,
            phash="1234567890abcdef",
            similarity=0.1,
        )

        image_index = ImageSimilarityIndex.from_goods([self.goods1, self.goods2])
        pair = GoodsSimilarityCalculator(
            image_index=image_index
        ).calculate_pair_similarity(self.goods1, self.goods2)

        self.assertTrue(pair.image_available)
        self.assertTrue(pair.phash_match)
        self.assertGreater(pair.score, 70)

    @override_settings(GOODS_SIMILAR_IMAGE_WEIGHT=0)
    def test_zero_image_weight_disables_image_similarity(self):
        self._attach_fingerprint(self.goods1, similarity=1.0)
        self._attach_fingerprint(self.goods2, similarity=1.0)

        metadata_score = self.calculator.calculate_metadata_similarity(
            self.goods1,
            self.goods2,
        )
        image_index = ImageSimilarityIndex.from_goods([self.goods1, self.goods2])
        pair = GoodsSimilarityCalculator(
            image_index=image_index
        ).calculate_pair_similarity(self.goods1, self.goods2)

        self.assertFalse(pair.image_available)
        self.assertFalse(pair.phash_match)
        self.assertEqual(pair.score, metadata_score)

    @override_settings(GOODS_SIMILAR_IMAGE_WEIGHT=100)
    def test_full_image_weight_ignores_metadata(self):
        self._attach_fingerprint(
            self.goods1,
            phash="0000000000000000",
            similarity=1.0,
        )
        self._attach_fingerprint(
            self.goods2,
            phash="ffffffffffffffff",
            similarity=0.7,
        )

        image_index = ImageSimilarityIndex.from_goods([self.goods1, self.goods2])
        pair = GoodsSimilarityCalculator(
            image_index=image_index
        ).calculate_pair_similarity(self.goods1, self.goods2)

        self.assertAlmostEqual(pair.score, 70.0, delta=1e-5)

    def test_phash_match_bypasses_min_similarity(self):
        self._attach_fingerprint(
            self.goods1,
            phash="1234567890abcdef",
            similarity=0.1,
        )
        self._attach_fingerprint(
            self.goods3,
            phash="1234567890abcdef",
            similarity=0.1,
        )
        image_index = ImageSimilarityIndex.from_goods([self.goods1, self.goods3])
        builder = SimilarityGroupBuilder(
            GoodsSimilarityCalculator(image_index=image_index)
        )

        groups = builder.build_groups(
            [self.goods1],
            [self.goods1, self.goods3],
            min_similarity=60,
        )

        self.assertEqual(groups[0], [self.goods1, self.goods3])


class SeedSelectorTestCase(TestCase):
    """测试种子选择器"""

    def setUp(self):
        """设置测试数据"""
        self.role = Role.objects.create(name='测试角色')
        self.user = User.objects.create(
            username='testuser',
            password='testpass123',
            role=self.role
        )

        self.ip1 = IP.objects.create(name='IP1', subject_type=4)
        self.ip2 = IP.objects.create(name='IP2', subject_type=4)
        self.cat = Category.objects.create(name='品类1')

        # 创建多个谷子
        self.goods_list = []
        for i in range(10):
            ip = self.ip1 if i < 5 else self.ip2
            goods = Goods.objects.create(
                user=self.user,
                name=f'谷子{i}',
                ip=ip,
                category=self.cat
            )
            self.goods_list.append(goods)

        self.selector = SeedSelector()

    def test_calculate_seed_count(self):
        """测试种子数量计算"""
        # <100个谷子
        count = self.selector._calculate_seed_count(50)
        self.assertEqual(count, 4)  # (50 // 18) * 2 = 4

        # 100-500个谷子
        count = self.selector._calculate_seed_count(200)
        self.assertEqual(count, 15)

        # >500个谷子
        count = self.selector._calculate_seed_count(1000)
        self.assertEqual(count, 20)

    def test_diverse_selection(self):
        """测试多样化选择"""
        seeds = self.selector._diverse_selection(self.goods_list, 3)
        self.assertEqual(len(seeds), 3)

        # 检查是否来自不同IP
        ip_ids = set(s.ip_id for s in seeds)
        self.assertGreater(len(ip_ids), 1)


class SimilarRandomEndpointTestCase(TestCase):
    """测试相似谷子随机展示接口"""

    def setUp(self):
        """设置测试数据"""
        cache.clear()
        self.client = APIClient()
        self.role = Role.objects.create(name='测试角色')
        self.user = User.objects.create(
            username='testuser',
            password='testpass123',
            role=self.role
        )
        self.client.force_authenticate(user=self.user)

        # 创建测试数据
        self.ip = IP.objects.create(name='测试IP', subject_type=4)
        self.cat = Category.objects.create(name='测试品类')

        # 创建20个谷子
        for i in range(20):
            Goods.objects.create(
                user=self.user,
                name=f'谷子{i}',
                ip=self.ip,
                category=self.cat
            )

    def test_similar_random_endpoint_exists(self):
        """测试端点是否存在"""
        response = self.client.get('/api/goods/similar-random/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_similar_random_response_format(self):
        """测试响应格式"""
        response = self.client.get('/api/goods/similar-random/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('count', data)
        self.assertIn('results', data)
        self.assertIn('page', data)
        self.assertIn('page_size', data)

    def test_similar_random_with_filters(self):
        """测试带过滤器的请求"""
        response = self.client.get(f'/api/goods/similar-random/?ip={self.ip.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertGreater(data['count'], 0)

    def test_similar_random_cache_key_includes_all_filters(self):
        """先缓存无筛选结果后，其他筛选条件不能复用该缓存。"""
        non_official = Goods.objects.filter(user=self.user).first()
        Goods.objects.filter(pk=non_official.pk).update(is_official=False)

        self.client.get('/api/goods/similar-random/?page_size=18')
        response = self.client.get(
            '/api/goods/similar-random/?is_official=false&page_size=18'
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['id'], str(non_official.id))

    def test_similar_random_pagination(self):
        """相似接口应按完整排序返回相邻页且不重不漏。"""
        first = self.client.get('/api/goods/similar-random/?page=1&page_size=10')
        second = self.client.get('/api/goods/similar-random/?page=2&page_size=10')

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        first_data = first.json()
        second_data = second.json()
        self.assertEqual(len(first_data['results']), 10)
        self.assertEqual(len(second_data['results']), 10)
        self.assertEqual(first_data['next'], 2)
        self.assertIsNone(second_data['next'])
        self.assertEqual(second_data['previous'], 1)

        first_ids = {item['id'] for item in first_data['results']}
        second_ids = {item['id'] for item in second_data['results']}
        self.assertFalse(first_ids & second_ids)
        self.assertEqual(len(first_ids | second_ids), 20)

    def test_similar_random_seed_strategies(self):
        """测试不同的种子策略"""
        strategies = ['diverse', 'popular', 'recent']
        for strategy in strategies:
            response = self.client.get(f'/api/goods/similar-random/?seed_strategy={strategy}')
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_small_dataset_keeps_phash_pair_together(self):
        """18 条以内也使用图片融合算法，同款 pHash 应保持相邻。"""
        Goods.objects.filter(user=self.user).delete()
        other_ip = IP.objects.create(name='另一IP', subject_type=4)
        first = Goods.objects.create(
            user=self.user,
            name='同款A',
            ip=self.ip,
            category=self.cat,
        )
        second = Goods.objects.create(
            user=self.user,
            name='同款B',
            ip=self.ip,
            category=self.cat,
        )
        third = Goods.objects.create(
            user=self.user,
            name='其他',
            ip=other_ip,
            category=self.cat,
        )
        for index, goods in enumerate((first, second)):
            Goods.objects.filter(pk=goods.pk).update(
                main_photo=f"goods/main/small-{index}.jpg"
            )
            GoodsImageFingerprint.objects.create(
                goods=goods,
                phash="1234567890abcdef",
                embedding=_embedding_bytes(_similarity_vector(0.5)),
                embedding_dim=384,
                algorithm_version="dinov2-small-int8-v1",
                source_name=f"goods/main/small-{index}.jpg",
            )

        response = self.client.get('/api/goods/similar-random/?page_size=18')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_ids = [item['id'] for item in response.json()['results']]
        first_index = result_ids.index(str(first.id))
        second_index = result_ids.index(str(second.id))
        self.assertEqual(abs(first_index - second_index), 1)


class GoodsDraftFlowTestCase(TestCase):
    """测试谷子草稿保存与发布流程"""

    def setUp(self):
        self.client = APIClient()
        self.role = Role.objects.create(name='测试角色')
        self.user = User.objects.create(
            username='draft_user',
            password='testpass123',
            role=self.role
        )
        self.client.force_authenticate(user=self.user)

        self.ip = IP.objects.create(name='草稿测试IP', subject_type=4)
        self.category = Category.objects.create(name='草稿测试品类')
        self.character = Character.objects.create(
            ip=self.ip,
            name='草稿测试角色',
            gender='female'
        )

    def test_create_draft_with_missing_required_fields(self):
        """草稿可缺省角色字段，但需满足模型非空外键约束"""
        payload = {
            "name": "草稿谷子A",
            "status": "draft",
            "ip_id": self.ip.id,
            "category_id": self.category.id,
            "quantity": 1,
        }
        response = self.client.post('/api/goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertTrue(data.get("saved_as_draft"))
        self.assertEqual(data.get("status"), "draft")

    def test_create_non_draft_requires_required_fields(self):
        """非草稿创建保持原有必填校验"""
        payload = {
            "name": "正式谷子A",
            "status": "in_cabinet",
            "quantity": 1,
        }
        response = self.client.post('/api/goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn("ip_id", data)
        self.assertIn("character_ids", data)
        self.assertIn("category_id", data)

    def test_create_draft_skips_duplicate_conflict(self):
        """草稿创建不触发重复检测冲突"""
        goods = Goods.objects.create(
            user=self.user,
            name='重复测试谷子',
            ip=self.ip,
            category=self.category,
            price=Decimal('66.00'),
            purchase_date=date(2025, 1, 1)
        )
        goods.characters.add(self.character)

        payload = {
            "name": "重复测试谷子",
            "status": "draft",
            "ip_id": self.ip.id,
            "category_id": self.category.id,
            "character_ids": [self.character.id],
            "price": "66.00",
            "purchase_date": "2025-01-01",
            "merge_strategy": "auto",
        }
        response = self.client.post('/api/goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.json().get("saved_as_draft"))

    def test_publish_draft_requires_required_fields(self):
        """草稿发布为非草稿时执行正式必填校验"""
        draft = Goods.objects.create(
            user=self.user,
            name='待发布草稿',
            ip=self.ip,
            category=self.category,
            status='draft',
        )
        # 让该草稿处于不完整状态（无角色）
        draft.characters.clear()

        response = self.client.patch(
            f'/api/goods/{draft.id}/',
            {"status": "in_cabinet"},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = response.json()
        self.assertIn("character_ids", data)


class GoodsCRUDTestCase(TestCase):
    """商品 CRUD 基本操作"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name='User')
        self.user = User.objects.create(username='crud_user', password='testpass123', role=self.role)
        self.client.force_authenticate(user=self.user)

        self.ip = IP.objects.create(name='测试IP', subject_type=4)
        self.category = Category.objects.create(name='测试品类')
        self.character = Character.objects.create(ip=self.ip, name='测试角色', gender='female')

    def test_create_goods_success(self):
        """正常创建商品"""
        payload = {
            "name": "新谷子",
            "ip_id": self.ip.id,
            "category_id": self.category.id,
            "character_ids": [self.character.id],
            "quantity": 1,
            "price": "99.00",
        }
        response = self.client.post('/api/goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["name"], "新谷子")

    def test_list_goods(self):
        """列出用户自己的商品"""
        Goods.objects.create(user=self.user, name='G1', ip=self.ip, category=self.category)
        response = self.client.get('/api/goods/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data)
        self.assertGreaterEqual(len(items), 1)

    def test_list_goods_filter_location_isnull(self):
        """可筛选未定位谷子，供位置作业台复用"""
        node = StorageNode.objects.create(name="柜子", user=self.user, path_name="柜子")
        unassigned = Goods.objects.create(user=self.user, name="待整理", ip=self.ip, category=self.category)
        assigned = Goods.objects.create(
            user=self.user, name="已定位", ip=self.ip, category=self.category, location=node
        )

        response = self.client.get('/api/goods/', {"location__isnull": "true"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data)
        ids = [item["id"] for item in items]
        self.assertIn(str(unassigned.id), ids)
        self.assertNotIn(str(assigned.id), ids)

    def test_retrieve_goods(self):
        """获取商品详情"""
        goods = Goods.objects.create(user=self.user, name='Detail', ip=self.ip, category=self.category)
        response = self.client.get(f'/api/goods/{goods.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["name"], "Detail")

    def test_update_goods(self):
        """更新商品名称"""
        goods = Goods.objects.create(
            user=self.user, name='Old', ip=self.ip, category=self.category,
            quantity=1
        )
        goods.characters.add(self.character)
        response = self.client.patch(
            f'/api/goods/{goods.id}/', {"name": "New"}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        goods.refresh_from_db()
        self.assertEqual(goods.name, "New")

    def test_update_goods_rejects_owner_change(self):
        goods = Goods.objects.create(
            user=self.user,
            name="Owned",
            ip=self.ip,
            category=self.category,
        )
        response = self.client.patch(
            f"/api/goods/{goods.id}/",
            {"user_id": self.user.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        goods.refresh_from_db()
        self.assertEqual(goods.user_id, self.user.id)

    def test_update_theme_rejects_owner_change(self):
        theme = Theme.objects.create(user=self.user, name="Owned Theme")
        response = self.client.patch(
            f"/api/themes/{theme.id}/",
            {"user_id": self.user.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        theme.refresh_from_db()
        self.assertEqual(theme.user_id, self.user.id)

    def test_delete_goods(self):
        """删除商品"""
        goods = Goods.objects.create(user=self.user, name='ToDelete', ip=self.ip, category=self.category)
        response = self.client.delete(f'/api/goods/{goods.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Goods.objects.filter(id=goods.id).exists())

    def test_other_user_cannot_see_goods(self):
        """其他用户看不到别人的商品"""
        Goods.objects.create(user=self.user, name='Private', ip=self.ip, category=self.category)
        other_role, _ = Role.objects.get_or_create(name='User')
        other = User.objects.create(username='other_user', role=other_role)
        self.client.force_authenticate(user=other)
        response = self.client.get('/api/goods/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data)
        names = [i["name"] for i in items]
        self.assertNotIn("Private", names)


class GoodsAdditionalPhotoOrderTestCase(TestCase):
    """附件图片顺序与重排接口。"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name='User')
        self.user = User.objects.create(
            username='photo_order_user',
            password='testpass123',
            role=self.role,
        )
        self.client.force_authenticate(user=self.user)
        self.ip = IP.objects.create(name='附件排序测试IP', subject_type=4)
        self.category = Category.objects.create(name='附件排序测试品类')
        self.character = Character.objects.create(
            ip=self.ip,
            name='附件排序测试角色',
            gender='female',
        )
        self.goods = Goods.objects.create(
            user=self.user,
            name='附件排序谷子',
            ip=self.ip,
            category=self.category,
        )
        self.goods.characters.add(self.character)

    def _image_file(self, name: str, color: str):
        buf = io.BytesIO()
        Image.new('RGB', (32, 32), color=color).save(buf, format='JPEG')
        buf.seek(0)
        return SimpleUploadedFile(name, buf.read(), content_type='image/jpeg')

    def test_retrieve_returns_photos_in_persisted_order(self):
        later = self.goods.additional_photos.create(
            image=self._image_file('later.jpg', 'red'),
            order=20,
        )
        earlier = self.goods.additional_photos.create(
            image=self._image_file('earlier.jpg', 'blue'),
            order=10,
        )

        response = self.client.get(f'/api/goods/{self.goods.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        photos = response.json()['additional_photos']
        self.assertEqual([photo['id'] for photo in photos], [earlier.id, later.id])
        self.assertEqual([photo['order'] for photo in photos], [10, 20])

    def test_new_uploads_are_appended(self):
        first = self.goods.additional_photos.create(
            image=self._image_file('first.jpg', 'green'),
            order=5,
        )

        response = self.client.post(
            f'/api/goods/{self.goods.id}/upload-additional-photos/',
            {'additional_photos': self._image_file('second.jpg', 'yellow')},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(first.order, 5)
        self.assertEqual(
            response.json()['created_photo_ids'],
            [
                photo['id']
                for photo in response.json()['additional_photos']
                if photo['id'] != first.id
            ],
        )
        new_photo_ids = [
            photo['id']
            for photo in response.json()['additional_photos']
            if photo['id'] != first.id
        ]
        self.assertEqual(len(new_photo_ids), 1)
        created = self.goods.additional_photos.get(id=new_photo_ids[0])
        self.assertEqual(created.order, 6)

    def test_upload_client_id_is_idempotent(self):
        payload = {
            'additional_photos': self._image_file('idempotent.jpg', 'cyan'),
            'client_upload_id': 'same-upload',
        }

        first = self.client.post(
            f'/api/goods/{self.goods.id}/upload-additional-photos/',
            payload,
            format='multipart',
        )
        second = self.client.post(
            f'/api/goods/{self.goods.id}/upload-additional-photos/',
            {
                'additional_photos': self._image_file('retry.jpg', 'magenta'),
                'client_upload_id': 'same-upload',
            },
            format='multipart',
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(
            first.json()['created_photo_ids'],
            second.json()['created_photo_ids'],
        )
        self.assertEqual(self.goods.additional_photos.count(), 1)

    def test_reorder_updates_all_photos_atomically(self):
        photos = [
            self.goods.additional_photos.create(
                image=self._image_file(f'photo-{index}.jpg', 'blue'),
                order=index,
            )
            for index in range(1, 4)
        ]

        response = self.client.post(
            f'/api/goods/{self.goods.id}/additional-photos/reorder/',
            {'photo_ids': [photos[2].id, photos[0].id, photos[1].id]},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned = response.json()['additional_photos']
        self.assertEqual(
            [photo['id'] for photo in returned],
            [photos[2].id, photos[0].id, photos[1].id],
        )
        self.assertEqual(
            list(
                self.goods.additional_photos.order_by('order', 'id')
                .values_list('id', flat=True)
            ),
            [photos[2].id, photos[0].id, photos[1].id],
        )

    def test_reorder_rejects_duplicate_missing_and_foreign_ids(self):
        photos = [
            self.goods.additional_photos.create(
                image=self._image_file(f'ordered-{index}.jpg', 'purple'),
                order=index,
            )
            for index in range(1, 3)
        ]
        other_goods = Goods.objects.create(
            user=self.user,
            name='另一件谷子',
            ip=self.ip,
            category=self.category,
        )
        foreign = other_goods.additional_photos.create(
            image=self._image_file('foreign.jpg', 'orange'),
            order=1,
        )
        url = f'/api/goods/{self.goods.id}/additional-photos/reorder/'

        duplicate = self.client.post(
            url,
            {'photo_ids': [photos[0].id, photos[0].id]},
            format='json',
        )
        missing = self.client.post(
            url,
            {'photo_ids': [photos[0].id]},
            format='json',
        )
        foreign_response = self.client.post(
            url,
            {'photo_ids': [photos[0].id, foreign.id]},
            format='json',
        )
        invalid_body = self.client.post(url, [photos[0].id], format='json')

        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(foreign_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_body.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            list(
                self.goods.additional_photos.order_by('order', 'id')
                .values_list('id', flat=True)
            ),
            [photos[0].id, photos[1].id],
        )


class ThemeTemplateAPITestCase(TestCase):
    """主题模板 API 与主题图片池联动。"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name='User')
        self.user = User.objects.create(username='template_user', password='testpass123', role=self.role)
        self.other_user = User.objects.create(username='template_other', password='testpass123', role=self.role)
        self.client.force_authenticate(user=self.user)

        self.ip = IP.objects.create(name='模板测试IP', subject_type=4)
        self.category = Category.objects.create(name='模板测试品类')
        self.character = Character.objects.create(ip=self.ip, name='模板测试角色', gender='female')
        self.partner = Character.objects.create(ip=self.ip, name='模板测试搭档', gender='other')
        self.theme = Theme.objects.create(user=self.user, name='模板主题')
        self.other_theme = Theme.objects.create(user=self.other_user, name='别人主题')

    def _image_file(self, name='test.jpg', color='blue'):
        buf = io.BytesIO()
        Image.new('RGB', (32, 32), color=color).save(buf, format='JPEG')
        buf.seek(0)
        return SimpleUploadedFile(name, buf.read(), content_type='image/jpeg')

    def _large_image_file(self, name='large.bmp'):
        buf = io.BytesIO()
        Image.new('RGB', (2000, 2000), color='purple').save(buf, format='BMP')
        buf.seek(0)
        return SimpleUploadedFile(name, buf.read(), content_type='image/bmp')

    def _response_debug(self, response):
        return getattr(response, "data", response.content)

    def test_create_or_update_theme_template(self):
        payload = {
            "name": "模板谷子名",
            "ip_id": self.ip.id,
            "character_ids": [self.character.id],
            "purchase_date": "2026-06-18",
            "is_official": True,
            "notes": "模板备注",
        }

        response = self.client.post(f'/api/themes/{self.theme.id}/template/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=self._response_debug(response))
        data = response.json()
        self.assertEqual(data["name"], "模板谷子名")
        self.assertEqual(data["ip"]["id"], self.ip.id)
        self.assertEqual([item["id"] for item in data["characters"]], [self.character.id])
        self.assertEqual(data["purchase_date"], "2026-06-18")
        self.assertTrue(data["is_official"])
        self.assertEqual(data["notes"], "模板备注")

        update_payload = {
            **payload,
            "name": "更新后的模板",
            "character_ids": [self.character.id, self.partner.id],
            "is_official": False,
        }
        response = self.client.post(f'/api/themes/{self.theme.id}/template/', update_payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=self._response_debug(response))
        data = response.json()
        self.assertEqual(data["name"], "更新后的模板")
        self.assertEqual([item["id"] for item in data["characters"]], [self.character.id, self.partner.id])
        self.assertFalse(data["is_official"])

    def test_update_template_ip_without_new_characters_revalidates_existing_characters(self):
        payload = {
            "name": "模板谷子名",
            "ip_id": self.ip.id,
            "character_ids": [self.character.id],
            "purchase_date": None,
            "is_official": True,
            "notes": "",
        }
        create_response = self.client.post(f'/api/themes/{self.theme.id}/template/', payload, format='json')
        self.assertEqual(create_response.status_code, status.HTTP_200_OK, msg=self._response_debug(create_response))
        other_ip = IP.objects.create(name='模板测试另一个IP', subject_type=4)

        response = self.client.post(
            f'/api/themes/{self.theme.id}/template/',
            {
                "name": payload["name"],
                "ip_id": other_ip.id,
                "purchase_date": None,
                "is_official": True,
                "notes": "",
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("character_ids", response.json())

    def test_get_theme_template_returns_template_and_images(self):
        self.client.post(
            f'/api/themes/{self.theme.id}/template/',
            {
                "name": "读取模板",
                "ip_id": self.ip.id,
                "character_ids": [self.character.id],
                "purchase_date": "2026-06-18",
                "is_official": True,
                "notes": "",
            },
            format='json',
        )
        ThemeImage.objects.create(theme=self.theme, image=self._image_file("theme.jpg"), label="海报")

        response = self.client.get(f'/api/themes/{self.theme.id}/template/')

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=self._response_debug(response))
        data = response.json()
        self.assertEqual(data["template"]["name"], "读取模板")
        self.assertEqual(len(data["images"]), 1)
        self.assertEqual(data["images"][0]["label"], "海报")

    def test_normal_user_cannot_access_other_users_theme_template(self):
        payload = {
            "name": "越权模板",
            "ip_id": self.ip.id,
            "character_ids": [self.character.id],
            "purchase_date": None,
            "is_official": False,
            "notes": "",
        }

        get_response = self.client.get(f'/api/themes/{self.other_theme.id}/template/')
        post_response = self.client.post(f'/api/themes/{self.other_theme.id}/template/', payload, format='json')

        self.assertEqual(get_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(post_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_copy_images_from_goods_requires_same_owner_and_theme(self):
        same_theme_goods = Goods.objects.create(
            user=self.user,
            name='同主题谷子',
            ip=self.ip,
            category=self.category,
            theme=self.theme,
            main_photo=self._image_file("main.jpg", "green"),
        )
        same_theme_goods.characters.add(self.character)
        same_theme_goods.additional_photos.create(
            image=self._image_file("extra.jpg", "red"),
            label="背板",
        )
        other_theme = Theme.objects.create(user=self.user, name='另一个主题')
        wrong_theme_goods = Goods.objects.create(
            user=self.user,
            name='错主题谷子',
            ip=self.ip,
            category=self.category,
            theme=other_theme,
            main_photo=self._image_file("wrong.jpg", "yellow"),
        )

        response = self.client.post(
            f'/api/themes/{self.theme.id}/copy-images-from-goods/',
            {"goods_id": str(same_theme_goods.id)},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=self._response_debug(response))
        self.assertEqual(ThemeImage.objects.filter(theme=self.theme).count(), 2)
        labels = set(ThemeImage.objects.filter(theme=self.theme).values_list("label", flat=True))
        self.assertEqual(labels, {"主图", "背板"})

        bad_response = self.client.post(
            f'/api/themes/{self.theme.id}/copy-images-from-goods/',
            {"goods_id": str(wrong_theme_goods.id)},
            format='json',
        )
        self.assertEqual(bad_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_copy_images_from_goods_compresses_copied_images(self):
        goods = Goods.objects.create(
            user=self.user,
            name='large image goods',
            ip=self.ip,
            category=self.category,
            theme=self.theme,
            main_photo=self._large_image_file(),
        )
        goods.characters.add(self.character)

        response = self.client.post(
            f'/api/themes/{self.theme.id}/copy-images-from-goods/',
            {"goods_id": str(goods.id)},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, msg=self._response_debug(response))
        copied = ThemeImage.objects.get(theme=self.theme)
        copied.image.open("rb")
        try:
            copied.image.seek(0, 2)
            self.assertLessEqual(copied.image.tell(), 300 * 1024)
        finally:
            copied.image.close()
        self.assertTrue(copied.image.name.lower().endswith(".jpg"))


class GoodsDuplicateDetectionTestCase(TestCase):
    """商品重复检测与合并策略"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name='User')
        self.user = User.objects.create(username='dup_user', password='testpass123', role=self.role)
        self.client.force_authenticate(user=self.user)

        self.ip = IP.objects.create(name='重复测试IP', subject_type=4)
        self.category = Category.objects.create(name='重复测试品类')
        self.character = Character.objects.create(ip=self.ip, name='重复角色', gender='female')

        self.existing = Goods.objects.create(
            user=self.user, name='已存在的谷子', ip=self.ip, category=self.category,
            price=Decimal('50.00'), purchase_date=date(2025, 1, 1)
        )
        self.existing.characters.add(self.character)

    def test_auto_merge_returns_409_with_candidates(self):
        """auto 策略检测到重复时返回 409"""
        payload = {
            "name": "已存在的谷子",
            "ip_id": self.ip.id,
            "category_id": self.category.id,
            "character_ids": [self.character.id],
            "price": "50.00",
            "purchase_date": "2025-01-01",
            "quantity": 1,
            "merge_strategy": "auto",
        }
        response = self.client.post('/api/goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        data = response.json()
        self.assertIn("candidates", data)
        self.assertGreater(len(data["candidates"]), 0)

    def test_merge_strategy_merges_into_existing(self):
        """merge 策略直接合并到已有商品"""
        payload = {
            "name": "已存在的谷子",
            "ip_id": self.ip.id,
            "category_id": self.category.id,
            "character_ids": [self.character.id],
            "price": "50.00",
            "purchase_date": "2025-01-01",
            "quantity": 2,
            "merge_strategy": "merge",
            "merge_target_id": str(self.existing.id),
        }
        response = self.client.post('/api/goods/', payload, format='json')
        # merge 可能返回 200 或 201
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])

    def test_new_strategy_creates_despite_duplicate(self):
        """new 策略强制新建即使有重复"""
        payload = {
            "name": "已存在的谷子",
            "ip_id": self.ip.id,
            "category_id": self.category.id,
            "character_ids": [self.character.id],
            "price": "50.00",
            "purchase_date": "2025-01-01",
            "quantity": 1,
            "merge_strategy": "new",
        }
        response = self.client.post('/api/goods/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # 应该有两个同名商品
        self.assertEqual(Goods.objects.filter(name='已存在的谷子').count(), 2)


class GoodsMoveTestCase(TestCase):
    """商品排序移动"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name='User')
        self.user = User.objects.create(username='move_user', password='testpass123', role=self.role)
        self.client.force_authenticate(user=self.user)

        self.ip = IP.objects.create(name='移动测试IP', subject_type=4)
        self.category = Category.objects.create(name='移动测试品类')

        self.g1 = Goods.objects.create(user=self.user, name='G1', ip=self.ip, category=self.category, order=1000)
        self.g2 = Goods.objects.create(user=self.user, name='G2', ip=self.ip, category=self.category, order=2000)
        self.g3 = Goods.objects.create(user=self.user, name='G3', ip=self.ip, category=self.category, order=3000)

    def test_move_goods_before_another(self):
        """将 G3 移动到 G1 前面"""
        response = self.client.post(
            f'/api/goods/{self.g3.id}/move/',
            {"anchor_id": self.g1.id, "position": "before"},
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT])


class GoodsStatsTestCase(TestCase):
    """商品统计看板"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name='User')
        self.user = User.objects.create(username='stats_user', password='testpass123', role=self.role)
        self.client.force_authenticate(user=self.user)

        self.ip = IP.objects.create(name='统计IP', subject_type=4)
        self.category = Category.objects.create(name='统计品类')
        for i in range(5):
            Goods.objects.create(
                user=self.user, name=f'S{i}', ip=self.ip, category=self.category,
                price=Decimal(str(10 + i * 10)), quantity=i + 1
            )

    def test_stats_endpoint(self):
        """统计接口返回正确结构"""
        response = self.client.get('/api/goods/stats/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("overview", data)
        overview = data["overview"]
        self.assertIn("goods_count", overview)
        self.assertEqual(overview["goods_count"], 5)


class GoodsCharacterStatsTestCase(TestCase):
    """角色厨力统计页接口"""

    def setUp(self):
        self.client = APIClient()
        self.user_role, _ = Role.objects.get_or_create(name='User')
        self.admin_role, _ = Role.objects.get_or_create(name='Admin')
        self.user = User.objects.create(username='character_stats_user', role=self.user_role)
        self.other_user = User.objects.create(username='other_stats_user', role=self.user_role)
        self.third_user = User.objects.create(username='third_stats_user', role=self.user_role)
        self.admin = User.objects.create(username='character_stats_admin', role=self.admin_role)

        self.ip = IP.objects.create(name='厨力测试IP', subject_type=4)
        self.whale_ip = IP.objects.create(name='单人重氪IP', subject_type=4)
        self.category_badge = Category.objects.create(name='徽章', path_name='徽章')
        self.category_stand = Category.objects.create(name='立牌', path_name='立牌')
        self.category_card = Category.objects.create(name='卡片', path_name='卡片')

        self.character = Character.objects.create(ip=self.ip, name='本命角色', gender='female')
        self.partner = Character.objects.create(ip=self.ip, name='搭档角色', gender='female')
        self.rival = Character.objects.create(ip=self.ip, name='同IP角色', gender='other')
        self.whale_character = Character.objects.create(ip=self.whale_ip, name='重氪角色', gender='male')

        self.user_target_a = self._goods(
            self.user, '本命徽章', self.ip, self.category_badge,
            price='100.00', quantity=2, status='in_cabinet', is_official=True,
        )
        self.user_target_a.characters.add(self.character)

        self.user_target_b = self._goods(
            self.user, '本命双人立牌', self.ip, self.category_stand,
            price='50.00', quantity=1, status='sold', is_official=False,
        )
        self.user_target_b.characters.add(self.character, self.partner)

        self.user_rival = self._goods(
            self.user, '同IP角色卡', self.ip, self.category_card,
            price='30.00', quantity=1,
        )
        self.user_rival.characters.add(self.rival)

        self.other_target = self._goods(
            self.other_user, '他人本命吧唧', self.ip, self.category_badge,
            price='1000.00', quantity=5,
        )
        self.other_target.characters.add(self.character)

        self.third_rival = self._goods(
            self.third_user, '第三用户同IP', self.ip, self.category_card,
            price='20.00', quantity=1,
        )
        self.third_rival.characters.add(self.rival)

        self.whale_goods = self._goods(
            self.other_user, '单人重氪', self.whale_ip, self.category_badge,
            price='10000.00', quantity=100,
        )
        self.whale_goods.characters.add(self.whale_character)
        Goods.objects.filter(id=self.whale_goods.id).update(
            created_at=timezone.now() - timedelta(days=45)
        )

        self.client.force_authenticate(user=self.user)

    def _goods(self, owner, name, ip, category, *, price, quantity, status='in_cabinet', is_official=True):
        return Goods.objects.create(
            user=owner,
            name=name,
            ip=ip,
            category=category,
            price=Decimal(price),
            quantity=quantity,
            status=status,
            is_official=is_official,
            purchase_date=date(2026, 1, 1),
        )

    def test_regular_user_stats_exclude_other_users_but_platform_heat_uses_all_users(self):
        response = self.client.get(f'/api/characters/{self.character.id}/stats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['character']['id'], self.character.id)
        self.assertEqual(data['overview']['goods_count'], 2)
        self.assertEqual(data['overview']['quantity_sum'], 3)
        self.assertEqual(data['overview']['value_sum'], '250.00')
        self.assertEqual(data['overview']['category_count'], 2)
        self.assertEqual(data['ip_heat']['platform_heat']['raw_metrics']['collectors_count'], 3)
        self.assertEqual(data['ip_heat']['my_heat']['raw_metrics']['quantity_sum'], 4)
        self.assertNotIn('other_stats_user', str(data))

    def test_admin_stats_include_all_users_for_character(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(f'/api/characters/{self.character.id}/stats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['overview']['goods_count'], 3)
        self.assertEqual(data['overview']['quantity_sum'], 8)
        self.assertEqual(data['overview']['value_sum'], '5250.00')

    def test_multi_character_goods_count_for_each_related_character(self):
        response = self.client.get(f'/api/characters/{self.partner.id}/stats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['overview']['goods_count'], 1)
        self.assertEqual(data['overview']['quantity_sum'], 1)
        self.assertEqual(data['overview']['value_sum'], '50.00')

    def test_platform_ip_heat_coverage_priority_beats_single_user_whale_ip(self):
        response = self.client.get(f'/api/characters/{self.character.id}/stats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        platform_heat = data['ip_heat']['platform_heat']
        self.assertEqual(platform_heat['rank'], 1)
        self.assertGreater(
            platform_heat['components']['collectors']['contribution'],
            platform_heat['components']['total_value']['contribution'],
        )
        self.assertEqual(platform_heat['raw_metrics']['recent_goods_count'], 5)

    def test_empty_visible_character_stats_return_zeroes(self):
        hidden = Character.objects.create(ip=self.ip, name='别人家的角色', gender='other')
        hidden_goods = self._goods(
            self.other_user, '别人家的谷', self.ip, self.category_badge,
            price='40.00', quantity=1,
        )
        hidden_goods.characters.add(hidden)

        response = self.client.get(f'/api/characters/{hidden.id}/stats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['overview']['goods_count'], 0)
        self.assertEqual(data['overview']['quantity_sum'], 0)
        self.assertEqual(data['overview']['value_sum'], '0.00')
        self.assertEqual(data['oshi_power']['score'], 0)
        self.assertEqual(data['oshi_power']['level'], '未开厨')

    def test_character_stats_requires_authentication(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(f'/api/characters/{self.character.id}/stats/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CategoryViewSetTestCase(TestCase):
    """品类 CRUD + 树形结构 + 级联删除"""

    def setUp(self):
        self.client = APIClient()
        self.admin_role, _ = Role.objects.get_or_create(name='Admin')
        self.user_role, _ = Role.objects.get_or_create(name='User')
        self.admin = User.objects.create(username='cat_admin', role=self.admin_role)
        self.admin.set_password('pass123')
        self.admin.save()
        self.user = User.objects.create(username='cat_user', role=self.user_role)
        self.client.force_authenticate(user=self.admin)

    def test_create_category(self):
        response = self.client.post(
            '/api/categories/', {"name": "吧唧"}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_tree_endpoint(self):
        """GET /api/categories/tree/ 返回扁平列表"""
        Category.objects.create(name='A', path_name='A')
        Category.objects.create(name='B', path_name='B')
        response = self.client.get('/api/categories/tree/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertGreaterEqual(len(data), 2)

    def test_destroy_empty_category(self):
        """删除无关联商品的品类"""
        cat = Category.objects.create(name='空品类')
        response = self.client.delete(f'/api/categories/{cat.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=cat.id).exists())

    def test_destroy_category_with_goods_blocked(self):
        """有关联商品的品类不能删除"""
        ip = IP.objects.create(name='测试IP')
        cat = Category.objects.create(name='有商品')
        user_role, _ = Role.objects.get_or_create(name='User')
        u = User.objects.create(username='catgoodsuser', role=user_role)
        Goods.objects.create(user=u, name='G', ip=ip, category=cat)
        response = self.client.delete(f'/api/categories/{cat.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_destroy_cascades_children(self):
        """删除父品类时级联删除子品类"""
        parent = Category.objects.create(name='父', path_name='父')
        child = Category.objects.create(name='子', parent=parent, path_name='父/子')
        response = self.client.delete(f'/api/categories/{parent.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Category.objects.filter(id=child.id).exists())

    def test_batch_update_order(self):
        """批量更新排序"""
        c1 = Category.objects.create(name='C1', order=0)
        c2 = Category.objects.create(name='C2', order=0)
        response = self.client.post(
            '/api/categories/batch-update-order/',
            {"items": [{"id": c1.id, "order": 2000}, {"id": c2.id, "order": 1000}]},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        c1.refresh_from_db()
        c2.refresh_from_db()
        self.assertEqual(c1.order, 2000)
        self.assertEqual(c2.order, 1000)

    def test_normal_user_can_read_categories(self):
        """普通用户可以读取品类"""
        Category.objects.create(name='公开品类')
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_normal_user_cannot_create_category(self):
        """普通用户不能创建品类"""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/categories/', {"name": "新"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class CompressImageTestCase(TestCase):
    """goods.utils — compress_image 图片压缩"""

    def _make_large_image(self, width=1000, height=1000, mode='RGB'):
        """创建一个大于 300KB 的测试图片"""
        import io
        from django.core.files.uploadedfile import InMemoryUploadedFile

        img = Image.new(mode, (width, height), color=(255, 0, 0) if mode == 'RGB' else (255, 0, 0, 128))
        buf = io.BytesIO()
        save_mode = 'PNG' if mode in ('RGBA', 'P') else 'BMP'
        img.save(buf, format=save_mode)
        buf.seek(0)
        size = buf.getbuffer().nbytes
        return InMemoryUploadedFile(buf, 'ImageField', f'test.{save_mode.lower()}', f'image/{save_mode.lower()}', size, None)

    def test_small_image_returns_none(self):
        """小于目标大小的图片不需要压缩"""
        import io
        from django.core.files.uploadedfile import InMemoryUploadedFile

        img = Image.new('RGB', (10, 10), color=(0, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        size = buf.getbuffer().nbytes
        f = InMemoryUploadedFile(buf, 'ImageField', 'tiny.png', 'image/png', size, None)
        result = compress_image(f, max_size_kb=300)
        self.assertIsNone(result)

    def test_rgba_converted_to_rgb(self):
        """RGBA 图片被转换为 RGB（JPEG 不支持透明度）"""
        import io
        from django.core.files.uploadedfile import InMemoryUploadedFile

        # 创建一个足够大的 RGBA BMP 图片
        img = Image.new('RGBA', (2000, 2000), color=(255, 0, 0, 128))
        buf = io.BytesIO()
        img.save(buf, format='BMP')
        buf.seek(0)
        size = buf.getbuffer().nbytes
        f = InMemoryUploadedFile(buf, 'ImageField', 'test.bmp', 'image/bmp', size, None)
        result = compress_image(f, max_size_kb=300)
        self.assertIsNotNone(result)
        self.assertTrue(result.name.endswith('.jpg') or result.name.endswith('.jpeg'))

    def test_compressed_within_size_limit(self):
        """压缩后的图片不超过目标大小"""
        f = self._make_large_image(width=2000, height=2000)
        result = compress_image(f, max_size_kb=300)
        self.assertIsNotNone(result)
        result.seek(0, 2)
        self.assertLessEqual(result.tell(), 300 * 1024)

    def test_none_input_returns_none(self):
        """None 输入返回 None"""
        self.assertIsNone(compress_image(None))

    def test_file_extension_normalized_to_jpg(self):
        """非 jpg 扩展名被改为 .jpg"""
        import io
        from django.core.files.uploadedfile import InMemoryUploadedFile

        img = Image.new('RGB', (800, 800), color=(128, 128, 128))
        buf = io.BytesIO()
        img.save(buf, format='BMP')
        buf.seek(0)
        size = buf.getbuffer().nbytes
        f = InMemoryUploadedFile(buf, 'ImageField', 'photo.bmp', 'image/bmp', size, None)
        result = compress_image(f, max_size_kb=300)
        if result is not None:
            self.assertTrue(result.name.endswith('.jpg'))


from ..classifier import classify_goods_image


class GoodsImageClassifierTests(TestCase):
    """图片形状分类器测试"""

    def setUp(self):
        # 圆形测试图
        self.round_img = Image.new('RGB', (200, 200), color='white')
        draw = ImageDraw.Draw(self.round_img)
        draw.ellipse([20, 20, 180, 180], fill='black')
        buf = io.BytesIO()
        self.round_img.save(buf, format='JPEG')
        self.round_bytes = buf.getvalue()

        # 矩形测试图
        self.rect_img = Image.new('RGB', (200, 200), color='white')
        draw2 = ImageDraw.Draw(self.rect_img)
        draw2.rectangle([20, 40, 180, 160], fill='black')
        buf2 = io.BytesIO()
        self.rect_img.save(buf2, format='JPEG')
        self.rect_bytes = buf2.getvalue()

        # 无清晰形状
        self.noise_img = Image.new('RGB', (200, 200), color='gray')
        buf3 = io.BytesIO()
        self.noise_img.save(buf3, format='JPEG')
        self.noise_bytes = buf3.getvalue()

    def _encode(self, image, image_format='PNG'):
        buf = io.BytesIO()
        image.save(buf, format=image_format)
        return buf.getvalue()

    def test_classify_round_image(self):
        result = classify_goods_image(self.round_bytes)
        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "round")
        self.assertGreaterEqual(result["confidence"], 0.5)

    def test_classify_rectangle_image(self):
        result = classify_goods_image(self.rect_bytes)
        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "rectangle")
        self.assertGreater(result["confidence"], 0.5)

    def test_classify_square_image(self):
        image = Image.new('RGB', (400, 400), color='white')
        ImageDraw.Draw(image).rectangle([90, 90, 310, 310], fill='black')

        result = classify_goods_image(self._encode(image))

        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "square")
        self.assertGreater(result["confidence"], 0.7)

    def test_classify_rotated_rectangle_image(self):
        image = Image.new('RGBA', (360, 180), color=(0, 0, 0, 0))
        ImageDraw.Draw(image).rectangle([0, 0, 359, 179], fill='black')
        image = image.rotate(35, expand=True, resample=Image.Resampling.BICUBIC)
        canvas = Image.new('RGB', (500, 500), color='white')
        canvas.paste(image, ((500 - image.width) // 2, (500 - image.height) // 2), image)

        result = classify_goods_image(self._encode(canvas))

        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "rectangle")

    def test_classify_border_touching_rounded_rectangle(self):
        image = Image.new('RGB', (500, 400), color='white')
        ImageDraw.Draw(image).rounded_rectangle(
            [0, 50, 499, 350], radius=30, fill='black'
        )

        result = classify_goods_image(self._encode(image, 'JPEG'))

        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "rectangle")

    def test_classify_round_body_with_irregular_protrusions_as_unknown(self):
        image = Image.new('RGB', (400, 400), color='white')
        draw = ImageDraw.Draw(image)
        draw.ellipse([60, 30, 340, 230], fill=(240, 80, 150))
        draw.polygon([(60, 120), (0, 60), (40, 150), (0, 220), (80, 190)], fill=(240, 80, 150))
        draw.polygon([(340, 120), (400, 60), (360, 150), (400, 220), (320, 190)], fill=(240, 80, 150))
        draw.rectangle([185, 220, 215, 399], fill=(240, 80, 150))

        result = classify_goods_image(self._encode(image, 'JPEG'))

        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "unknown")

    def test_classify_low_contrast_rectangle_image(self):
        img = Image.new('RGB', (200, 200), color=(245, 245, 245))
        draw = ImageDraw.Draw(img)
        draw.rectangle([20, 40, 180, 160], fill=(230, 230, 230), outline=(215, 215, 215), width=3)
        buf = io.BytesIO()
        img.save(buf, format='JPEG')

        result = classify_goods_image(buf.getvalue())

        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "rectangle")

    def test_classify_rectangle_with_inner_circles_as_rectangle(self):
        img = Image.new('RGB', (1600, 1200), color='white')
        draw = ImageDraw.Draw(img)
        draw.rectangle([100, 390, 1500, 820], fill=(40, 35, 60), outline=(190, 150, 70), width=16)
        draw.rectangle([180, 470, 1420, 750], fill=(120, 165, 220), outline=(210, 170, 80), width=10)
        draw.rectangle([220, 500, 1380, 720], fill=(130, 170, 220))
        for box in ([600, 500, 800, 700], [850, 500, 1050, 700], [1100, 500, 1300, 700]):
            draw.ellipse(box, outline=(245, 245, 250), width=16)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=95)

        result = classify_goods_image(buf.getvalue())

        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "rectangle")

    def test_classify_no_clear_shape(self):
        result = classify_goods_image(self.noise_bytes)
        self.assertEqual(result["shape_type"], "unknown")

    def test_classify_random_noise_as_unknown(self):
        rng = np.random.default_rng(123)
        image = Image.fromarray(rng.integers(0, 256, (400, 400, 3), dtype=np.uint8), 'RGB')

        result = classify_goods_image(self._encode(image))

        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "unknown")

    def test_classify_ellipse_as_unknown(self):
        image = Image.new('RGB', (400, 400), color='white')
        ImageDraw.Draw(image).ellipse([55, 100, 345, 300], fill='black')

        result = classify_goods_image(self._encode(image))

        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "unknown")

    def test_classify_multiple_objects_as_unknown(self):
        image = Image.new('RGB', (400, 400), color='white')
        draw = ImageDraw.Draw(image)
        draw.ellipse([35, 135, 155, 255], fill='black')
        draw.ellipse([245, 135, 365, 255], fill='black')

        result = classify_goods_image(self._encode(image))

        self.assertIsNotNone(result)
        self.assertEqual(result["shape_type"], "unknown")

    def test_classify_unknown_image(self):
        result = classify_goods_image(b"not an image")
        self.assertIsNone(result)


class GoodsClassifyAPITests(TestCase):
    """图片分类 API 测试"""

    def setUp(self):
        from apps.users.models import User, Role
        self.client = APIClient()
        role = Role.objects.create(name="分类测试")
        self.user = User.objects.create(username="classifyuser", password="test123", role=role)
        self.client.force_authenticate(user=self.user)
        Category.objects.get_or_create(
            name="吧唧", defaults={"shape_type": "round", "path_name": "吧唧"}
        )
        self.badge_parent = Category.objects.get(name="吧唧")
        self.badge_58 = Category.objects.create(
            name="58mm吧唧",
            parent=self.badge_parent,
            path_name="吧唧/58mm吧唧",
        )
        self.badge_75 = Category.objects.create(
            name="75mm吧唧",
            parent=self.badge_parent,
            path_name="吧唧/75mm吧唧",
        )
        self.irregular_badge = Category.objects.create(
            name="异形吧唧",
            parent=self.badge_parent,
            path_name="吧唧/异形吧唧",
            shape_type="round",
        )
        self.square_badge = Category.objects.create(
            name="70×44mm",
            parent=Category.objects.create(
                name="方形吧唧",
                parent=self.irregular_badge,
                path_name="吧唧/异形吧唧/方形吧唧",
            ),
            path_name="吧唧/异形吧唧/方形吧唧/70×44mm",
        )
        self.heart_badge = Category.objects.create(
            name="57×54mm",
            parent=Category.objects.create(
                name="心形吧唧",
                parent=self.irregular_badge,
                path_name="吧唧/异形吧唧/心形吧唧",
            ),
            path_name="吧唧/异形吧唧/心形吧唧/57×54mm",
        )
        self.paper_square = Category.objects.create(
            name="方卡",
            parent=Category.objects.create(name="纸制品", path_name="纸制品"),
            path_name="纸制品/方卡",
            shape_type="square",
        )
        Category.objects.get_or_create(
            name="小卡", defaults={"shape_type": "rectangle", "path_name": "小卡"}
        )
        self.polaroid = Category.objects.create(name="拍立得", path_name="拍立得")

    def _create_jpeg(self, draw_func, size=(200, 200)):
        img = Image.new('RGB', size, color='white')
        d = ImageDraw.Draw(img)
        draw_func(d)
        buf = io.BytesIO()
        img.save(buf, format='JPEG')
        buf.seek(0)
        return buf

    def test_classify_round_returns_suggestions(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = self._create_jpeg(lambda d: d.ellipse([20, 20, 180, 180], fill='black'))
        image_file = SimpleUploadedFile("test.jpg", buf.read(), content_type="image/jpeg")

        resp = self.client.post(
            reverse("goods-classify-image"),
            {"image": image_file},
            format="multipart",
        )

        self.assertEqual(resp.status_code, 200, msg=resp.data)
        data = resp.data
        self.assertEqual(data["shape_type"], "round")
        self.assertGreaterEqual(data["confidence"], 0.5)
        self.assertTrue(len(data["suggestions"]) > 0)
        suggestion_ids = {item["id"] for item in data["suggestions"]}
        self.assertIn(self.badge_58.id, suggestion_ids)
        self.assertIn(self.badge_75.id, suggestion_ids)

    def test_classify_round_excludes_irregular_badge_branch(self):
        """圆形图只推荐常规圆形吧唧，不展开异形吧唧生产分支。"""
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = self._create_jpeg(lambda d: d.ellipse([20, 20, 180, 180], fill='black'))
        image_file = SimpleUploadedFile("round.jpg", buf.read(), content_type="image/jpeg")

        resp = self.client.post(
            reverse("goods-classify-image"),
            {"image": image_file},
            format="multipart",
        )

        self.assertEqual(resp.status_code, 200, msg=resp.data)
        data = resp.data
        self.assertEqual(data["shape_type"], "round")
        paths = [item["path_name"] for item in data["suggestions"]]
        self.assertTrue(any("58mm" in path for path in paths), msg=paths)
        self.assertTrue(any("75mm" in path for path in paths), msg=paths)
        self.assertFalse(any("异形" in path for path in paths), msg=paths)
        suggestion_ids = {item["id"] for item in data["suggestions"]}
        self.assertNotIn(self.square_badge.id, suggestion_ids)
        self.assertNotIn(self.heart_badge.id, suggestion_ids)

    def test_classify_rectangle_returns_suggestions(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = self._create_jpeg(lambda d: d.rectangle([20, 40, 180, 160], fill='black'))
        image_file = SimpleUploadedFile("test.jpg", buf.read(), content_type="image/jpeg")

        resp = self.client.post(
            reverse("goods-classify-image"),
            {"image": image_file},
            format="multipart",
        )

        self.assertEqual(resp.status_code, 200, msg=resp.data)
        data = resp.data
        self.assertEqual(data["shape_type"], "rectangle")
        suggestion_ids = {item["id"] for item in data["suggestions"]}
        self.assertIn(self.polaroid.id, suggestion_ids)

    def test_classify_square_returns_square_suggestions(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = self._create_jpeg(lambda d: d.rectangle([20, 20, 180, 180], fill='black'))
        image_file = SimpleUploadedFile("square.jpg", buf.read(), content_type="image/jpeg")

        resp = self.client.post(
            reverse("goods-classify-image"),
            {"image": image_file},
            format="multipart",
        )

        self.assertEqual(resp.status_code, 200, msg=resp.data)
        self.assertEqual(resp.data["shape_type"], "square")
        suggestion_ids = {item["id"] for item in resp.data["suggestions"]}
        self.assertIn(self.paper_square.id, suggestion_ids)
        self.assertIn(self.square_badge.id, suggestion_ids)

    def test_classify_no_shape_returns_unknown(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = self._create_jpeg(lambda d: None)
        image_file = SimpleUploadedFile("test.jpg", buf.read(), content_type="image/jpeg")

        resp = self.client.post(
            reverse("goods-classify-image"),
            {"image": image_file},
            format="multipart",
        )

        self.assertEqual(resp.status_code, 200, msg=resp.data)
        self.assertEqual(resp.data["shape_type"], "unknown")
        self.assertEqual(resp.data["suggestions"], [])
        self.assertIn("单一主体轮廓", resp.data["detail"])

    def test_classify_requires_auth(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.client.force_authenticate(user=None)
        buf = self._create_jpeg(lambda d: d.ellipse([20, 20, 180, 180], fill='black'))
        image_file = SimpleUploadedFile("test.jpg", buf.read(), content_type="image/jpeg")
        resp = self.client.post(
            reverse("goods-classify-image"),
            {"image": image_file},
            format="multipart",
        )
        self.assertIn(resp.status_code, (401, 403), msg=resp.data)

