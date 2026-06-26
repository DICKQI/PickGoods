from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import Role, User
from apps.goods.models import Category, Goods, IP


class CategoryGoodsCountTestCase(TestCase):
    """品类列表中的谷子件数统计"""

    def setUp(self):
        self.client = APIClient()
        self.admin_role, _ = Role.objects.get_or_create(name="Admin")
        self.user_role, _ = Role.objects.get_or_create(name="User")
        self.admin = User.objects.create(username="cat_count_admin", role=self.admin_role)
        self.user = User.objects.create(username="cat_count_user", role=self.user_role)

    def test_normal_user_category_goods_count_sums_own_non_draft_descendants_quantity(self):
        """普通用户品类件数只统计自己的非草稿谷子，并汇总子孙品类 quantity"""
        root = Category.objects.create(name="周边", path_name="周边")
        child = Category.objects.create(name="吧唧", parent=root, path_name="周边/吧唧")
        grandchild = Category.objects.create(name="圆形吧唧", parent=child, path_name="周边/吧唧/圆形吧唧")
        empty = Category.objects.create(name="空品类", path_name="空品类")
        ip = IP.objects.create(name="统计测试IP")
        other_user = User.objects.create(username="cat_count_other_user", role=self.user_role)

        Goods.objects.create(user=self.user, name="自己的根品类谷子", ip=ip, category=root, quantity=2)
        Goods.objects.create(user=self.user, name="自己的子品类谷子", ip=ip, category=child, quantity=3)
        Goods.objects.create(user=self.user, name="自己的孙品类谷子", ip=ip, category=grandchild, quantity=4)
        Goods.objects.create(user=self.user, name="自己的草稿谷子", ip=ip, category=child, quantity=50, status="draft")
        Goods.objects.create(user=other_user, name="他人的谷子", ip=ip, category=child, quantity=70)

        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/categories/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        counts = {item["id"]: item["goods_count"] for item in response.json()}
        self.assertEqual(counts[root.id], 9)
        self.assertEqual(counts[child.id], 7)
        self.assertEqual(counts[grandchild.id], 4)
        self.assertEqual(counts[empty.id], 0)

    def test_admin_category_goods_count_all_scope_sums_all_users_non_draft_quantity(self):
        """管理员显式请求 all scope 时统计全站非草稿谷子件数"""
        root = Category.objects.create(name="周边", path_name="周边")
        child = Category.objects.create(name="吧唧", parent=root, path_name="周边/吧唧")
        ip = IP.objects.create(name="管理员统计测试IP")
        other_user = User.objects.create(username="cat_count_admin_other_user", role=self.user_role)

        Goods.objects.create(user=self.admin, name="管理员谷子", ip=ip, category=root, quantity=2)
        Goods.objects.create(user=self.user, name="普通用户谷子", ip=ip, category=child, quantity=3)
        Goods.objects.create(user=other_user, name="另一个用户谷子", ip=ip, category=child, quantity=4)
        Goods.objects.create(user=other_user, name="另一个用户草稿", ip=ip, category=child, quantity=80, status="draft")

        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/categories/", {"goods_count_scope": "all"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        counts = {item["id"]: item["goods_count"] for item in response.json()}
        self.assertEqual(counts[root.id], 9)
        self.assertEqual(counts[child.id], 7)

    def test_normal_user_cannot_use_all_category_goods_count_scope(self):
        """普通用户传 all scope 仍只能看到自己的品类件数"""
        cat = Category.objects.create(name="吧唧", path_name="吧唧")
        ip = IP.objects.create(name="scope测试IP")
        other_user = User.objects.create(username="cat_count_scope_other_user", role=self.user_role)
        Goods.objects.create(user=self.user, name="自己的谷子", ip=ip, category=cat, quantity=2)
        Goods.objects.create(user=other_user, name="他人的谷子", ip=ip, category=cat, quantity=5)

        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/categories/", {"goods_count_scope": "all"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["goods_count"], 2)

    def test_tree_endpoint_includes_goods_count(self):
        """GET /api/categories/tree/ 同样返回品类件数字段"""
        cat = Category.objects.create(name="吧唧", path_name="吧唧")
        ip = IP.objects.create(name="tree统计测试IP")
        Goods.objects.create(user=self.user, name="tree谷子", ip=ip, category=cat, quantity=6)

        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/categories/tree/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()[0]["goods_count"], 6)

    def test_filtered_category_list_still_counts_hidden_descendants(self):
        """列表过滤只返回父品类时，件数仍按完整品类树汇总子孙品类"""
        root = Category.objects.create(name="周边", path_name="周边")
        child = Category.objects.create(name="吧唧", parent=root, path_name="周边/吧唧")
        ip = IP.objects.create(name="过滤统计测试IP")
        Goods.objects.create(user=self.user, name="子品类谷子", ip=ip, category=child, quantity=5)

        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/categories/", {"parent__isnull": "true"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [
            {
                "id": root.id,
                "name": "周边",
                "parent": None,
                "path_name": "周边",
                "color_tag": None,
                "shape_type": None,
                "order": 0,
                "goods_count": 5,
            }
        ])
