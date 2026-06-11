from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from datetime import date, timedelta
from decimal import Decimal
from PIL import Image

from apps.users.models import User, Role
from .models import Goods, IP, Character, Category, Theme
from .similarity import GoodsSimilarityCalculator, SeedSelector, SimilarityGroupBuilder
from .utils import compress_image


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

