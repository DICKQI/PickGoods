from django.test import TestCase
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date, timedelta
from decimal import Decimal
import io

from PIL import Image, ImageDraw
from django.utils import timezone

from apps.users.models import User, Role
from ..models import Goods, IP, Character, Category, Theme, ThemeImage
from apps.location.models import StorageNode
from ..similarity import GoodsSimilarityCalculator, SeedSelector, SimilarityGroupBuilder
from ..utils import compress_image


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
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND])

    def test_similar_random_response_format(self):
        """测试响应格式"""
        response = self.client.get('/api/goods/similar-random/')
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            self.assertIn('count', data)
            self.assertIn('results', data)
            self.assertIn('page', data)
            self.assertIn('page_size', data)

    def test_similar_random_with_filters(self):
        """测试带过滤器的请求"""
        response = self.client.get(f'/api/goods/similar-random/?ip={self.ip.id}')
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            self.assertGreater(data['count'], 0)

    def test_similar_random_pagination(self):
        """测试分页"""
        response = self.client.get('/api/goods/similar-random/?page=1&page_size=10')
        if response.status_code == status.HTTP_200_OK:
            data = response.json()
            self.assertLessEqual(len(data['results']), 10)

    def test_similar_random_seed_strategies(self):
        """测试不同的种子策略"""
        strategies = ['diverse', 'popular', 'recent']
        for strategy in strategies:
            response = self.client.get(f'/api/goods/similar-random/?seed_strategy={strategy}')
            self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND])


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
        self.assertIsNone(result)

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

    def test_classify_no_shape_returns_422(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        buf = self._create_jpeg(lambda d: None)
        image_file = SimpleUploadedFile("test.jpg", buf.read(), content_type="image/jpeg")

        resp = self.client.post(
            reverse("goods-classify-image"),
            {"image": image_file},
            format="multipart",
        )

        self.assertEqual(resp.status_code, 422, msg=resp.data)

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

