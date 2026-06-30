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

    def test_update_name_regenerates_descendant_path_names(self):
        root = StorageNode.objects.create(name="旧房间", user=self.user, path_name="旧房间")
        child = StorageNode.objects.create(
            name="柜子", user=self.user, parent=root, path_name="旧房间/柜子"
        )
        leaf = StorageNode.objects.create(
            name="第1层", user=self.user, parent=child, path_name="旧房间/柜子/第1层"
        )

        response = self.client.patch(
            f"/api/location/nodes/{root.id}/", {"name": "新房间"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        child.refresh_from_db()
        leaf.refresh_from_db()
        self.assertEqual(child.path_name, "新房间/柜子")
        self.assertEqual(leaf.path_name, "新房间/柜子/第1层")

    def test_create_accepts_business_fields(self):
        response = self.client.post(
            "/api/location/nodes/",
            {
                "name": "A柜",
                "code": "A-01",
                "capacity": 12,
                "node_type": "cabinet",
                "is_favorite": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["code"], "A-01")
        self.assertEqual(data["capacity"], 12)
        self.assertEqual(data["node_type"], "cabinet")
        self.assertTrue(data["is_favorite"])


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

    def test_move_node_changes_parent_order_and_descendant_paths(self):
        root_a = StorageNode.objects.create(name="A房间", user=self.user1, path_name="A房间")
        root_b = StorageNode.objects.create(name="B房间", user=self.user1, path_name="B房间")
        cabinet = StorageNode.objects.create(
            name="柜子", user=self.user1, parent=root_a, path_name="A房间/柜子"
        )
        shelf = StorageNode.objects.create(
            name="第1层", user=self.user1, parent=cabinet, path_name="A房间/柜子/第1层"
        )
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            f"/api/location/nodes/{cabinet.id}/move/",
            {"parent": root_b.id, "order": 7},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        cabinet.refresh_from_db()
        shelf.refresh_from_db()
        self.assertEqual(cabinet.parent, root_b)
        self.assertEqual(cabinet.order, 7)
        self.assertEqual(cabinet.path_name, "B房间/柜子")
        self.assertEqual(shelf.path_name, "B房间/柜子/第1层")

    def test_move_node_rejects_moving_under_own_descendant(self):
        root = StorageNode.objects.create(name="房间", user=self.user1, path_name="房间")
        child = StorageNode.objects.create(
            name="柜子", user=self.user1, parent=root, path_name="房间/柜子"
        )
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(
            f"/api/location/nodes/{root.id}/move/",
            {"parent": child.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


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

    def test_tree_contains_direct_and_descendant_goods_counts(self):
        ip = IP.objects.create(name="树计数IP")
        cat = Category.objects.create(name="树计数品类")
        Goods.objects.create(user=self.user, name="根谷子", ip=ip, category=cat, location=self.root)
        Goods.objects.create(user=self.user, name="子谷子", ip=ip, category=cat, location=self.child)

        response = self.client.get("/api/location/tree/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = response.json()
        if isinstance(items, dict):
            items = items.get("results", items)
        root_item = next(i for i in items if i["id"] == self.root.id)
        child_item = next(i for i in items if i["id"] == self.child.id)
        self.assertEqual(root_item["goods_count"], 1)
        self.assertEqual(root_item["descendant_goods_count"], 2)
        self.assertEqual(child_item["goods_count"], 1)
        self.assertEqual(child_item["descendant_goods_count"], 1)


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

    def test_summary_returns_counts_recent_goods_and_status_distribution(self):
        response = self.client.get(f"/api/location/nodes/{self.node.id}/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["direct_goods_count"], 1)
        self.assertEqual(data["descendant_goods_count"], 2)
        self.assertEqual(data["child_node_count"], 1)
        self.assertIsNone(data["capacity"])
        self.assertIsNone(data["capacity_usage_ratio"])
        self.assertEqual(data["status_distribution"]["in_cabinet"], 2)
        self.assertEqual(len(data["recent_goods"]), 2)

    def test_summary_uses_capacity_for_usage_ratio(self):
        self.node.capacity = 4
        self.node.save(update_fields=["capacity"])

        response = self.client.get(f"/api/location/nodes/{self.node.id}/summary/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["capacity"], 4)
        self.assertEqual(data["capacity_usage_ratio"], 0.5)

    def test_batch_move_goods_to_location(self):
        target = StorageNode.objects.create(name="新位置", user=self.user, path_name="新位置")

        response = self.client.post(
            "/api/location/move-goods/",
            {"goods_ids": [str(self.goods1.id), str(self.goods2.id)], "target_location": target.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.goods1.refresh_from_db()
        self.goods2.refresh_from_db()
        self.assertEqual(self.goods1.location, target)
        self.assertEqual(self.goods2.location, target)
        self.assertEqual(response.json()["moved_count"], 2)

    def test_batch_move_rejects_other_user_goods(self):
        other = User.objects.create(username="other_goods_owner", role=self.role)
        other_goods = Goods.objects.create(
            user=other, name="别人谷子", ip=self.ip, category=self.cat, location=None
        )

        response = self.client.post(
            "/api/location/move-goods/",
            {"goods_ids": [str(other_goods.id)], "target_location": self.node.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        other_goods.refresh_from_db()
        self.assertIsNone(other_goods.location)

    def test_unassigned_goods_returns_goods_without_location(self):
        unassigned = Goods.objects.create(
            user=self.user, name="待整理", ip=self.ip, category=self.cat, location=None
        )

        response = self.client.get("/api/location/unassigned-goods/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        items = data.get("results", data) if isinstance(data, dict) else data
        ids = [item["id"] for item in items]
        self.assertIn(str(unassigned.id), ids)
        self.assertNotIn(str(self.goods1.id), ids)
