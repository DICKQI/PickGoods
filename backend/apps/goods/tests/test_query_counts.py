"""列表/详情接口的查询数回归测试。

这些用例锁定的是「预取是否仍然生效」，而不是具体实现。核心信号：
``GoodsListSerializer`` / ``GoodsDetailSerializer`` 嵌套了 ``IPSimpleSerializer``，
它序列化 ``character_count``（未注解时逐行 ``SELECT COUNT(*)``）和 ``keywords``
（未预取时逐行查询）。一旦有人重新加上 ``select_related("ip")``，Django 会用 JOIN
出的实例覆盖 prefetch 结果、丢掉注解，接口依然返回 200 且数据看起来正确，只是
SQL 数量随行数线性增长。因此页大小无关性用例如下。
"""
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient

from apps.users.models import Role, User

from ..models import Category, Character, Goods, IP, IPKeyword

# 每页 18 条时的 SQL 上界。实测 8 条，留少量余量给 DRF 分页计数等固定开销。
GOODS_LIST_MAX_QUERIES = 10
# 页大小放大到 100 时不得增加。固定开销允许 ±2。
GOODS_LIST_PAGE_SLACK = 2
GOODS_DETAIL_MAX_QUERIES = 10
CHARACTER_LIST_MAX_QUERIES = 6


class QueryCountTestCase(TestCase):
    """公共夹具：足够多的 IP / 角色 / 关键词，让 N+1 一旦复现就必然超限。"""

    IP_COUNT = 6
    CHARACTERS_PER_IP = 3
    GOODS_COUNT = 30

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name="QueryCountUser")
        self.user = User.objects.create(
            username="query_count_user", password="x", role=self.role
        )
        self.client.force_authenticate(user=self.user)

        self.ips = [IP.objects.create(name=f"计数IP{i}") for i in range(self.IP_COUNT)]
        for ip in self.ips:
            IPKeyword.objects.create(ip=ip, value=f"关键词-{ip.name}")

        self.categories = [Category.objects.create(name=f"计数品类{i}") for i in range(4)]
        self.characters = [
            Character.objects.create(
                ip=self.ips[i % self.IP_COUNT], name=f"计数角色{i}", gender="female"
            )
            for i in range(self.IP_COUNT * self.CHARACTERS_PER_IP)
        ]

        self.goods = []
        for i in range(self.GOODS_COUNT):
            item = Goods.objects.create(
                name=f"计数谷子{i}",
                user=self.user,
                ip=self.ips[i % self.IP_COUNT],
                category=self.categories[i % len(self.categories)],
                quantity=1,
                price="10.00",
                status="owned",
                order=i,
            )
            # 每个谷子挂 3 个角色，制造 M2M 嵌套
            item.characters.set(self.characters[:3])
            self.goods.append(item)


class GoodsListQueryCountTests(QueryCountTestCase):
    def test_goods_list_query_count_bounded(self):
        """列表页 SQL 数必须与行数解耦。"""
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/goods/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["results"], "夹具应至少返回一条谷子")
        self.assertLessEqual(
            len(ctx.captured_queries),
            GOODS_LIST_MAX_QUERIES,
            "列表 SQL 数超出上界，预取可能失效：\n"
            + "\n".join(q["sql"][:160] for q in ctx.captured_queries),
        )

    def test_goods_list_query_count_independent_of_page_size(self):
        """页大小放大 5 倍，SQL 数不应增长。

        这是本文件最重要的一条：``select_related('ip')`` 与 ``Prefetch('ip')``
        共存会让注解静默丢失，而响应内容完全正常——只有 SQL 计数能发现。
        """
        with CaptureQueriesContext(connection) as ctx:
            small = self.client.get("/api/goods/", {"page_size": 18})
        small_count = len(ctx.captured_queries)

        with CaptureQueriesContext(connection) as ctx:
            large = self.client.get("/api/goods/", {"page_size": 100})
        large_count = len(ctx.captured_queries)

        self.assertEqual(small.status_code, 200)
        self.assertEqual(large.status_code, 200)
        self.assertGreater(
            len(large.json()["results"]),
            len(small.json()["results"]),
            "两次页大小应返回不同条数，否则该用例无效",
        )
        self.assertLessEqual(
            large_count,
            small_count + GOODS_LIST_PAGE_SLACK,
            f"SQL 数随页大小增长（{small_count} -> {large_count}），"
            "说明 IP 的注解或关键词预取已经失效",
        )

    def test_goods_detail_query_count_bounded(self):
        """详情页同样嵌套 IPSimpleSerializer，不能漏修。"""
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(f"/api/goods/{self.goods[0].id}/")

        self.assertEqual(response.status_code, 200)
        self.assertLessEqual(
            len(ctx.captured_queries),
            GOODS_DETAIL_MAX_QUERIES,
            "\n".join(q["sql"][:160] for q in ctx.captured_queries),
        )


class GoodsListPayloadTests(QueryCountTestCase):
    def test_ip_payload_still_correct(self):
        """查询数达标后，嵌套 IP 的数据必须仍然正确。

        防的是「注解写成别的聚合」或「prefetch 顺序把 ip 弄成了 None」。
        """
        response = self.client.get("/api/goods/")
        self.assertEqual(response.status_code, 200)

        results = response.json()["results"]
        self.assertTrue(results)

        for row in results:
            ip_payload = row["ip"]
            self.assertIsNotNone(ip_payload)
            real_ip = IP.objects.get(pk=ip_payload["id"])

            self.assertEqual(
                ip_payload["character_count"],
                real_ip.characters.count(),
                f"IP {real_ip.name} 的 character_count 与实际角色数不符",
            )
            self.assertIsInstance(ip_payload["character_count"], int)
            self.assertIsInstance(ip_payload["keywords"], list)
            self.assertEqual(
                sorted(kw["value"] for kw in ip_payload["keywords"]),
                sorted(real_ip.keywords.values_list("value", flat=True)),
                f"IP {real_ip.name} 的关键词列表不符",
            )

    def test_nested_character_ip_also_annotated(self):
        """``characters[].ip`` 也走 IPSimpleSerializer，同样要有 character_count。"""
        response = self.client.get("/api/goods/")
        self.assertEqual(response.status_code, 200)

        checked = 0
        for row in response.json()["results"]:
            for character in row["characters"]:
                nested_ip = character["ip"]
                self.assertIsNotNone(nested_ip)
                real_ip = IP.objects.get(pk=nested_ip["id"])
                self.assertEqual(
                    nested_ip["character_count"],
                    real_ip.characters.count(),
                    f"角色 {character['name']} 的嵌套 IP 角色数不符",
                )
                checked += 1

        self.assertGreater(checked, 0, "夹具应至少产生一个嵌套角色 IP")


class CharacterListQueryCountTests(QueryCountTestCase):
    def test_characters_list_query_count_bounded(self):
        """/api/characters/ 无分页，N+1 会随角色总数放大。"""
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/characters/")

        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.json()), self.CHARACTERS_PER_IP)
        self.assertLessEqual(
            len(ctx.captured_queries),
            CHARACTER_LIST_MAX_QUERIES,
            "\n".join(q["sql"][:160] for q in ctx.captured_queries),
        )

    def test_characters_list_ip_annotation_correct(self):
        response = self.client.get("/api/characters/")
        self.assertEqual(response.status_code, 200)

        for row in response.json():
            nested_ip = row["ip"]
            self.assertIsNotNone(nested_ip)
            real_ip = IP.objects.get(pk=nested_ip["id"])
            self.assertEqual(
                nested_ip["character_count"], real_ip.characters.count()
            )

    def test_characters_filtered_by_ip_query_count_bounded(self):
        """按 IP 过滤后同样不能退化。"""
        target = self.ips[0]
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get("/api/characters/", {"ip": target.id})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json())
        self.assertLessEqual(
            len(ctx.captured_queries),
            CHARACTER_LIST_MAX_QUERIES,
            "\n".join(q["sql"][:160] for q in ctx.captured_queries),
        )
