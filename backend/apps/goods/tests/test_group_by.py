"""group_by 分组排序的回归测试。

这些用例锁住两件事：
1. 排序语义（组内最新时间倒序 → 组内 created_at 倒序 → NULL 分组键排最后）；
2. 实现方式不能退回 annotate(Max('<fk>__goods__created_at'))——那是跨反向 FK 的
   聚合，会生成 JOIN + GROUP BY + 临时排序，LIMIT 无效，生产实测 1.6 秒。

历史教训：第一版实现没有剔除 None 分组键，导致无主题谷子被排到最前而不是最后。
真实数据（1064 条里 181 条无主题）才暴露出来，所以这些用例刻意覆盖 NULL 分支。
"""
from datetime import timedelta

from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import Role, User

from ..models import Category, Character, Goods, IP, Theme

# group_by=ip 的 SQL 上界：预聚合 1 + 取序键 1 + 分页 1 + 装载页 1 + 嵌套预取若干
GROUP_BY_MAX_QUERIES = 14


class GroupByTestBase(TestCase):
    """构造可控的 created_at 与分组归属，便于断言精确顺序。"""

    def setUp(self):
        self.client = APIClient()
        self.role, _ = Role.objects.get_or_create(name="GroupByUser")
        self.user = User.objects.create(
            username="group_by_user", password="x", role=self.role
        )
        self.client.force_authenticate(user=self.user)

        self.ip_a = IP.objects.create(name="分组IPA")
        self.ip_b = IP.objects.create(name="分组IPB")
        self.cat_a = Category.objects.create(name="分组品类A")
        self.cat_b = Category.objects.create(name="分组品类B")
        self.theme_a = Theme.objects.create(user=self.user, name="分组主题A")
        self.theme_b = Theme.objects.create(user=self.user, name="分组主题B")
        self.char_a = Character.objects.create(ip=self.ip_a, name="分组角色A")
        self.char_b = Character.objects.create(ip=self.ip_b, name="分组角色B")

        self.base_time = timezone.now() - timedelta(days=30)

    def make_goods(self, name, minutes, *, ip=None, category=None, theme=None,
                   characters=(), user=None):
        """创建谷子并显式设置 created_at（auto_now_add 需要事后 update）。"""
        item = Goods.objects.create(
            name=name,
            user=user or self.user,
            ip=ip or self.ip_a,
            category=category or self.cat_a,
            theme=theme,
            quantity=1,
            price="10.00",
            status="owned",
            order=0,
        )
        Goods.objects.filter(pk=item.pk).update(
            created_at=self.base_time + timedelta(minutes=minutes)
        )
        item.refresh_from_db()
        if characters:
            item.characters.set(characters)
        return item

    def get_ids(self, **params):
        params.setdefault("page_size", 100)
        response = self.client.get("/api/goods/", params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return [row["id"] for row in response.json()["results"]]


class GroupOrderTestCase(GroupByTestBase):
    def test_group_order_by_ip(self):
        """组按「该 IP 下最新谷子时间」倒序；组内按 created_at 倒序。"""
        # IP A：最晚 10 分钟；IP B：最晚 50 分钟 -> B 的整体组更新
        a_old = self.make_goods("A旧", 1, ip=self.ip_a)
        a_new = self.make_goods("A新", 10, ip=self.ip_a)
        b_only = self.make_goods("B唯一", 50, ip=self.ip_b)

        ids = self.get_ids(group_by="ip")
        self.assertEqual(ids, [str(b_only.id), str(a_new.id), str(a_old.id)])

    def test_group_order_by_category(self):
        c_a_old = self.make_goods("品类A旧", 1, category=self.cat_a)
        c_a_new = self.make_goods("品类A新", 20, category=self.cat_a)
        c_b = self.make_goods("品类B", 40, category=self.cat_b)

        ids = self.get_ids(group_by="category")
        self.assertEqual(ids, [str(c_b.id), str(c_a_new.id), str(c_a_old.id)])

    def test_group_order_by_theme(self):
        t_a_old = self.make_goods("主题A旧", 1, theme=self.theme_a)
        t_a_new = self.make_goods("主题A新", 15, theme=self.theme_a)
        t_b = self.make_goods("主题B", 30, theme=self.theme_b)

        ids = self.get_ids(group_by="theme")
        self.assertEqual(ids, [str(t_b.id), str(t_a_new.id), str(t_a_old.id)])

    def test_group_order_by_character(self):
        c_a_old = self.make_goods("角色A旧", 1, characters=[self.char_a])
        c_a_new = self.make_goods("角色A新", 25, characters=[self.char_a])
        c_b = self.make_goods("角色B", 60, characters=[self.char_b])

        ids = self.get_ids(group_by="character")
        self.assertEqual(ids, [str(c_b.id), str(c_a_new.id), str(c_a_old.id)])


class GroupNullHandlingTestCase(GroupByTestBase):
    """NULL 分组键必须排最后——第一版实现曾在这里静默出错。"""

    def test_null_theme_sorted_last(self):
        with_theme = self.make_goods("有主题", 10, theme=self.theme_a)
        no_theme_1 = self.make_goods("无主题1", 90, theme=None)
        no_theme_2 = self.make_goods("无主题2", 5, theme=None)

        ids = self.get_ids(group_by="theme")
        # 有主题的整体排前面，尽管它的组最新时间比无主题谷子更早
        self.assertEqual(ids[0], str(with_theme.id))
        self.assertEqual(
            set(ids[1:]), {str(no_theme_1.id), str(no_theme_2.id)}
        )

    def test_null_character_sorted_last(self):
        with_char = self.make_goods("有角色", 10, characters=[self.char_a])
        no_char = self.make_goods("无角色", 99, characters=[])

        ids = self.get_ids(group_by="character")
        self.assertEqual(ids, [str(with_char.id), str(no_char.id)])


class GroupDedupeTestCase(GroupByTestBase):
    def test_character_group_dedupes(self):
        """一个谷子关联多个角色时不得重复出现。"""
        item = self.make_goods(
            "双角色", 10, characters=[self.char_a, self.char_b]
        )
        other = self.make_goods("单角色", 5, characters=[self.char_a])

        ids = self.get_ids(group_by="character")
        self.assertEqual(len(ids), len(set(ids)), "按角色分组出现了重复行")
        self.assertEqual(set(ids), {str(item.id), str(other.id)})

    def test_group_count_matches_distinct_goods(self):
        """count 必须是去重后的谷子数，不受多对多 JOIN 影响。"""
        self.make_goods("多角色1", 10, characters=[self.char_a, self.char_b])
        self.make_goods("多角色2", 20, characters=[self.char_a, self.char_b])

        response = self.client.get("/api/goods/", {"group_by": "character"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["count"], 2)


class GroupPaginationTestCase(GroupByTestBase):
    def test_group_by_pagination_consistent(self):
        """逐页翻完应恰好覆盖全量，无重复无遗漏（排序必须确定）。"""
        total = 25
        for i in range(total):
            self.make_goods(
                f"翻页{i}",
                i,
                ip=self.ip_a if i % 2 else self.ip_b,
                category=self.cat_a if i % 3 else self.cat_b,
                theme=self.theme_a if i % 4 else None,
                characters=[self.char_a] if i % 2 else [self.char_b],
            )

        for group_by in ("ip", "category", "theme", "character"):
            collected = []
            page = 1
            while True:
                response = self.client.get(
                    "/api/goods/",
                    {"group_by": group_by, "page": page, "page_size": 7},
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                body = response.json()
                collected.extend(row["id"] for row in body["results"])
                if not body.get("next"):
                    break
                page += 1

            self.assertEqual(
                len(collected), total, f"{group_by}: 翻页总数不等于全量"
            )
            self.assertEqual(
                len(set(collected)), total, f"{group_by}: 翻页出现重复"
            )


class GroupQueryCountTestCase(GroupByTestBase):
    def test_group_by_avoids_full_table_aggregate(self):
        """分组排序不得对谷子表本身做 GROUP BY。

        这条是本文件的核心护栏。注意不能只看 SQL **条数**——旧实现在小数据上
        同样只有个位数条 SQL，代价在单条语句的复杂度上：它把同组所有谷子 JOIN
        进来、再按谷子的每一列 GROUP BY，导致 LIMIT 对聚合无效，生产 1064 条
        实测 1.6 秒。

        判别特征是 ``GROUP BY`` 子句里出现了 ``goods_goods.id``——即正在对谷子
        表本身分组。合法写法只有两类：
        - 聚合分组键小表：``GROUP BY ip_id`` / ``GROUP BY characters__id``；
        - 装载当前页：有 JOIN 但没有对 goods_goods 分组。
        """
        for i in range(40):
            self.make_goods(
                f"计数{i}",
                i,
                ip=self.ip_a if i % 2 else self.ip_b,
                category=self.cat_a if i % 3 else self.cat_b,
                theme=self.theme_a if i % 4 else None,
                characters=[self.char_a] if i % 2 else [self.char_b],
            )

        offenders = []
        for group_by in ("ip", "category", "theme", "character"):
            with CaptureQueriesContext(connection) as ctx:
                response = self.client.get(
                    "/api/goods/", {"group_by": group_by, "page_size": 10}
                )
            self.assertEqual(response.status_code, status.HTTP_200_OK)

            for query in ctx.captured_queries:
                sql = query["sql"]
                upper = sql.upper()
                if "GROUP BY" not in upper:
                    continue
                group_clause = upper[upper.index("GROUP BY"):]
                if '"GOODS_GOODS"."ID"' in group_clause:
                    offenders.append((group_by, sql[:200]))

        self.assertEqual(
            offenders,
            [],
            "分组排序对谷子表做了全表 GROUP BY（LIMIT 对聚合无效，会退化成 1.6s）：\n"
            + "\n".join(f"[{g}] {s}" for g, s in offenders),
        )

    def test_group_by_query_count_bounded(self):
        """SQL 条数也应有上界，防止预取失效或逐行查询。"""
        for i in range(40):
            self.make_goods(
                f"计数{i}",
                i,
                ip=self.ip_a if i % 2 else self.ip_b,
                category=self.cat_a if i % 3 else self.cat_b,
                theme=self.theme_a if i % 4 else None,
                characters=[self.char_a] if i % 2 else [self.char_b],
            )

        with CaptureQueriesContext(connection) as ctx:
            small = self.client.get("/api/goods/", {"group_by": "ip", "page_size": 10})
        small_count = len(ctx.captured_queries)

        with CaptureQueriesContext(connection) as ctx:
            large = self.client.get("/api/goods/", {"group_by": "ip", "page_size": 40})
        large_count = len(ctx.captured_queries)

        self.assertEqual(small.status_code, status.HTTP_200_OK)
        self.assertEqual(large.status_code, status.HTTP_200_OK)
        self.assertGreater(
            len(large.json()["results"]),
            len(small.json()["results"]),
            "两次页大小应返回不同条数，否则该用例无效",
        )
        self.assertLessEqual(
            small_count,
            GROUP_BY_MAX_QUERIES,
            "group_by 的 SQL 条数超出上界：\n"
            + "\n".join(q["sql"][:160] for q in ctx.captured_queries),
        )
        self.assertLessEqual(
            large_count,
            small_count + 2,
            f"SQL 条数随页大小增长（{small_count} -> {large_count}）",
        )


class GroupWithFilterTestCase(GroupByTestBase):
    def test_group_by_with_search_and_filter(self):
        """搜索 + 字段过滤 + 分组组合，结果集应正确。"""
        target = self.make_goods(
            "独特甲", 30, ip=self.ip_a, category=self.cat_a, theme=self.theme_a
        )
        # 名字不能包含 "独特甲" 的子串，否则 icontains 会一起命中
        self.make_goods(
            "无关乙", 60, ip=self.ip_b, category=self.cat_b, theme=self.theme_b
        )

        response = self.client.get(
            "/api/goods/",
            {"group_by": "ip", "search": "独特甲", "page_size": 100},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual([row["id"] for row in body["results"]], [str(target.id)])

    def test_group_by_other_user_goods_invisible(self):
        """分组不能绕过租户隔离。"""
        other_role = self.role
        other = User.objects.create(
            username="group_by_other", password="x", role=other_role
        )
        mine = self.make_goods("我的", 10)
        self.make_goods("别人的", 99, user=other)

        ids = self.get_ids(group_by="ip")
        self.assertEqual(ids, [str(mine.id)])

    def test_invalid_group_by_rejected(self):
        response = self.client.get("/api/goods/", {"group_by": "notafield"})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
