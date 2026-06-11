from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.goods.models import Goods, IP, Category
from apps.users.models import Role, User
from .models import StorageNode


class StorageNodeModelTestCase(TestCase):
    """location.models — StorageNode 基本属性"""

    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="locuser", role=self.role)

    def test_create_root_node(self):
        node = StorageNode.objects.create(name="书房", user=self.user, path_name="书房")
        self.assertEqual(str(node), "书房")
        self.assertIsNone(node.parent)

    def test_create_child_node(self):
        parent = StorageNode.objects.create(name="书房", user=self.user, path_name="书房")
        child = StorageNode.objects.create(
            name="书架A", user=self.user, parent=parent, path_name="书房/书架A"
        )
        self.assertEqual(child.parent, parent)
        self.assertEqual(str(child), "书房/书架A")


class StorageNodeSerializerTestCase(TestCase):
    """location.serializers — StorageNodeSerializer path_name 自动生成"""

    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="seruser", role=self.role)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_root_node_auto_path_name(self):
        response = self.client.post(
            "/api/location/nodes/", {"name": "卧室"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["path_name"], "卧室")

    def test_create_child_node_auto_path_name(self):
        parent = StorageNode.objects.create(name="卧室", user=self.user, path_name="卧室")
        response = self.client.post(
            "/api/location/nodes/", {"name": "衣柜", "parent": parent.id}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["path_name"], "卧室/衣柜")

    def test_create_with_explicit_path_name(self):
        response = self.client.post(
            "/api/location/nodes/", {"name": "A", "path_name": "自定义路径"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["path_name"], "自定义路径")

    def test_update_name_regenerates_path_name(self):
        node = StorageNode.objects.create(name="旧名", user=self.user, path_name="旧名")
        response = self.client.patch(
            f"/api/location/nodes/{node.id}/", {"name": "新名"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["path_name"], "新名")


class StorageNodeViewTestCase(TestCase):
    """location.views — CRUD + 权限"""

    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user1 = User.objects.create(username="user1", role=self.role)
        self.user2 = User.objects.create(username="user2", role=self.role)
        self.client = APIClient()

    def test_list_only_own_nodes(self):
        StorageNode.objects.create(name="A", user=self.user1, path_name="A")
        StorageNode.objects.create(name="B", user=self.user2, path_name="B")
        self.client.force_authenticate(user=self.user1)
        response = self.client.get("/api/location/nodes/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json()
        items = results.get("results", results) if isinstance(results, dict) else results
        for item in items:
            self.assertEqual(item["id"], StorageNode.objects.get(name="A").id)

    def test_create_node(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(
            "/api/location/nodes/", {"name": "新房"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        node = StorageNode.objects.get(id=response.json()["id"])
        self.assertEqual(node.user, self.user1)

    def test_retrieve_node(self):
        node = StorageNode.objects.create(name="N", user=self.user1, path_name="N")
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(f"/api/location/nodes/{node.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_node(self):
        node = StorageNode.objects.create(name="N", user=self.user1, path_name="N")
        self.client.force_authenticate(user=self.user1)
        response = self.client.patch(
            f"/api/location/nodes/{node.id}/", {"name": "N2"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        node.refresh_from_db()
        self.assertEqual(node.name, "N2")

    def test_delete_cascades_children_and_unlinks_goods(self):
        """删除节点时级联删除子节点，并将关联商品的 location 置 null"""
        parent = StorageNode.objects.create(name="P", user=self.user1, path_name="P")
        child = StorageNode.objects.create(
            name="C", user=self.user1, parent=parent, path_name="P/C"
        )
        ip = IP.objects.create(name="测试IP")
        cat = Category.objects.create(name="测试品类")
        goods = Goods.objects.create(
            user=self.user1, name="G", ip=ip, category=cat, location=child
        )
        self.client.force_authenticate(user=self.user1)
        response = self.client.delete(f"/api/location/nodes/{parent.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(StorageNode.objects.filter(id=parent.id).exists())
        self.assertFalse(StorageNode.objects.filter(id=child.id).exists())
        goods.refresh_from_db()
        self.assertIsNone(goods.location)

    def test_other_user_cannot_access(self):
        node = StorageNode.objects.create(name="X", user=self.user1, path_name="X")
        self.client.force_authenticate(user=self.user2)
        response = self.client.get(f"/api/location/nodes/{node.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class StorageNodeTreeTestCase(TestCase):
    """GET /api/location/tree/"""

    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="treeuser", role=self.role)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.root = StorageNode.objects.create(
            name="房间", user=self.user, path_name="房间"
        )
        self.child = StorageNode.objects.create(
            name="柜子", user=self.user, parent=self.root, path_name="房间/柜子"
        )

    def test_tree_returns_flat_list(self):
        response = self.client.get("/api/location/tree/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        self.assertEqual(len(items), 2)

    def test_tree_contains_parent_field(self):
        response = self.client.get("/api/location/tree/")
        items = response.json()
        if isinstance(items, dict):
            items = items.get("results", items)
        root_item = next(i for i in items if i["id"] == self.root.id)
        child_item = next(i for i in items if i["id"] == self.child.id)
        self.assertIsNone(root_item["parent"])
        self.assertEqual(child_item["parent"], self.root.id)


class StorageNodeGoodsTestCase(TestCase):
    """GET /api/location/{id}/goods/"""

    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name="User")
        self.user = User.objects.create(username="goodsuser", role=self.role)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.node = StorageNode.objects.create(
            name="架子", user=self.user, path_name="架子"
        )
        self.child_node = StorageNode.objects.create(
            name="层1", user=self.user, parent=self.node, path_name="架子/层1"
        )

        self.ip = IP.objects.create(name="测试IP")
        self.cat = Category.objects.create(name="测试品类")
        self.goods1 = Goods.objects.create(
            user=self.user, name="G1", ip=self.ip, category=self.cat, location=self.node
        )
        self.goods2 = Goods.objects.create(
            user=self.user, name="G2", ip=self.ip, category=self.cat, location=self.child_node
        )

    def test_goods_at_node_only(self):
        response = self.client.get(f"/api/location/nodes/{self.node.id}/goods/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        ids = [i["id"] for i in items]
        self.assertIn(str(self.goods1.id), ids)
        # without include_children, only direct goods
        self.assertNotIn(str(self.goods2.id), ids)

    def test_goods_include_children(self):
        response = self.client.get(
            f"/api/location/nodes/{self.node.id}/goods/?include_children=true"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        ids = [i["id"] for i in items]
        self.assertIn(str(self.goods1.id), ids)
        self.assertIn(str(self.goods2.id), ids)
