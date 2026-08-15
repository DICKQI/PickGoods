from datetime import date
from io import BytesIO
from unittest.mock import patch

from django.db import models
from django.test import TestCase
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.goods.models import Category, Character, IP
from apps.ocr.parser import (
    _clean_ocr_name,
    _compact_name,
    _extract_order_date,
    _extract_shop_name,
    match_metadata,
    parse_ocr_items,
    parse_ocr_results,
    parse_preorder,
)
from apps.users.models import Role, User


def entry(text, y, x=220, score=0.98):
    return {
        'text': text,
        'score': score,
        'box': [x, y, x + 240, y + 30],
    }


class OcrParserTestCase(TestCase):
    def test_parse_multiple_items_prefers_paid_price_and_order_date(self):
        entries = [
            entry('【米哈游/崩坏：星穹铁道】', 100),
            entry('￥12.86', 100, x=620),
            entry('帕姆展览馆系列方形徽章：交光', 150),
            entry('￥15', 150, x=690),
            entry('x1', 200, x=710),
            entry('【米哈游/崩坏：星穹铁道】', 360),
            entry('￥8.57', 360, x=620),
            entry('小不点猫猫系列镭射收藏票；风堇', 410),
            entry('￥10', 410, x=690),
            entry('X1', 460, x=710),
            entry('商品总价', 900, x=30),
            entry('订单信息 2026-05-23', 1000, x=30),
        ]

        items = parse_ocr_items(entries)

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]['price'], '12.86')
        self.assertEqual(items[1]['price'], '8.57')
        self.assertEqual(items[0]['purchase_date'], '2026-05-23')
        self.assertEqual(items[1]['purchase_date'], '2026-05-23')
        self.assertIn('帕姆展览馆', items[0]['name'])
        self.assertIn('镭射收藏票', items[1]['name'])

    def test_price_above_title_row_stays_with_current_item(self):
        entries = [
            entry('加入购物车', 20, x=410),
            entry('【米哈游/崩坏：星穹铁道】', 113),
            entry('￥12.86', 110, x=620),
            entry('帕姆展览馆系列方形徽章：交光', 167),
            entry('￥15', 165, x=690),
            entry('X1', 218, x=710),
            entry('加入购物车', 285, x=410),
            entry('【米哈游/崩坏：星穹铁道】', 376),
            entry('￥8.57', 373, x=620),
            entry('小不点猫猫系列镭射收藏票；风堇', 428),
            entry('￥10', 427, x=690),
            entry('X1', 481, x=710),
            entry('商品总价', 992, x=30),
        ]

        items = parse_ocr_items(entries)

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]['price'], '12.86')
        self.assertEqual(items[1]['price'], '8.57')
        self.assertNotIn('￥8.57', items[0]['source_lines'])

    def test_low_confidence_quantity_defaults_to_one_with_warning(self):
        items = parse_ocr_items([
            entry('【米哈游/崩坏：星穹铁道】', 100),
            entry('￥15', 100, x=620),
            entry('小不点猫猫系列马口铁徽章：遐蝶', 150),
            entry('X7', 200, x=710, score=0.63),
        ])

        self.assertEqual(items[0]['quantity'], 1)
        self.assertTrue(items[0]['warnings'])

    def test_order_total_quantity_does_not_override_last_item_quantity(self):
        items = parse_ocr_items([
            entry('【米哈游/崩坏：星穹铁道】', 100),
            entry('￥15', 100, x=620),
            entry('小不点猫猫系列马口铁徽章：遐蝶', 150),
            entry('商品总价', 230, x=30),
            entry('共3件', 230, x=160),
            entry('￥40', 230, x=650),
        ])

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['quantity'], 1)
        self.assertNotIn('共3件', items[0]['name'])


class OcrRecognizeApiTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        role, _ = Role.objects.get_or_create(name='User')
        self.user = User.objects.create(username='ocr_user', password='pass', role=role)
        self.client.force_authenticate(user=self.user)
        ip = IP.objects.create(name='崩坏：星穹铁道')
        Character.objects.create(ip=ip, name='交光')
        self.category = Category.objects.create(name='徽章', path_name='徽章')
        # OCR 结果缓存按图片字节哈希共享，测试占位图字节相同会互相污染，须清空
        from django.core.cache import cache
        cache.clear()

    def _image_file(self):
        image = Image.new('RGB', (40, 40), 'white')
        buffer = BytesIO()
        image.save(buffer, format='JPEG')
        buffer.seek(0)
        buffer.name = 'order.jpg'
        return buffer

    @patch('apps.ocr.views._prepare_and_run_ocr')
    def test_recognize_returns_items_and_first_item_compat_fields(self, run_mock):
        run_mock.return_value = [
            entry('【米哈游/崩坏：星穹铁道】', 100),
            entry('￥12.86', 100, x=620),
            entry('帕姆展览馆系列方形徽章：交光', 150),
            entry('x1', 200, x=710),
            entry('商品总价', 900, x=30),
            entry('订单信息 2026-05-23', 1000, x=30),
        ]

        response = self.client.post(
            '/api/ocr/recognize/',
            {'image': self._image_file()},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('items', data)
        self.assertEqual(len(data['items']), 1)
        self.assertEqual(data['price'], '12.86')
        self.assertEqual(data['items'][0]['purchase_date'], '2026-05-23')
        self.assertIn('source_lines', data['items'][0])


class OcrParserHelperTestCase(TestCase):
    """OCR 解析器辅助函数测试"""

    def test_extract_order_date_standard_format(self):
        """标准日期格式 2025-06-01"""
        lines = [
            {'text': '订单信息 2025-06-01', 'score': 0.98, 'box': [0, 0, 300, 30]},
        ]
        result = _extract_order_date(lines)
        self.assertEqual(result, '2025-06-01')

    def test_extract_order_date_slash_format(self):
        """斜杠日期格式 2025/06/01"""
        lines = [
            {'text': '订单详情 2025/06/15', 'score': 0.98, 'box': [0, 0, 300, 30]},
        ]
        result = _extract_order_date(lines)
        self.assertEqual(result, '2025-06-15')

    def test_extract_order_date_chinese_format(self):
        """中文日期格式 2025年06月01日"""
        lines = [
            {'text': '2025年06月01日 下单', 'score': 0.98, 'box': [0, 0, 300, 30]},
        ]
        result = _extract_order_date(lines)
        self.assertEqual(result, '2025-06-01')

    def test_extract_order_date_no_date(self):
        """无日期返回 None"""
        lines = [
            {'text': '商品总价 ￥50', 'score': 0.98, 'box': [0, 0, 300, 30]},
        ]
        result = _extract_order_date(lines)
        self.assertIsNone(result)

    def test_extract_shop_name(self):
        """含"店"关键字的行"""
        lines = [
            {'text': '米哈游旗舰店', 'score': 0.98, 'box': [0, 0, 300, 30]},
        ]
        result = _extract_shop_name(lines)
        self.assertEqual(result, '米哈游旗舰店')

    def test_extract_shop_name_no_match(self):
        """无店铺名返回 None"""
        lines = [
            {'text': '商品总价 ￥50', 'score': 0.98, 'box': [0, 0, 300, 30]},
        ]
        result = _extract_shop_name(lines)
        self.assertIsNone(result)

    def test_clean_ocr_name(self):
        """清洗 OCR 名称"""
        result = _clean_ocr_name('  帕姆展览馆  ')
        self.assertEqual(result, '帕姆展览馆')

    def test_compact_name(self):
        """紧凑名称"""
        result = _compact_name('帕姆 展览 馆')
        self.assertIn('帕姆', result)

    def test_parse_ocr_results_basic(self):
        """parse_ocr_results 基本解析"""
        lines = [
            '崩坏：星穹铁道 帕姆展览馆系列方形徽章',
            '￥12.86',
            'x1',
        ]
        result = parse_ocr_results(lines)
        self.assertIn('name', result)
        self.assertIn('price', result)
        self.assertEqual(result['price'], '12.86')


class MatchMetadataTestCase(TestCase):
    """match_metadata 测试"""

    def setUp(self):
        self.ip1 = IP.objects.create(name='崩坏：星穹铁道')
        self.ip2 = IP.objects.create(name='原神')
        self.char1 = Character.objects.create(ip=self.ip1, name='流萤', gender='female')
        self.char2 = Character.objects.create(ip=self.ip2, name='纳西妲', gender='female')
        self.cat1 = Category.objects.create(name='徽章', path_name='徽章')
        self.cat2 = Category.objects.create(name='亚克力立牌', path_name='亚克力立牌')

        self.all_ips = list(IP.objects.values_list('id', 'name'))
        self.all_characters = list(
            Character.objects.values_list('id', 'name', 'ip_id').annotate(
                ip_name=models.F('ip__name')
            )
        )
        self.all_categories = list(Category.objects.values_list('id', 'name', 'path_name'))

    def test_match_ip_by_name(self):
        """通过名称匹配 IP"""
        result = match_metadata(
            '崩坏：星穹铁道 帕姆展览馆系列徽章',
            self.all_ips, self.all_characters, self.all_categories
        )
        ip = result.get('ip')
        self.assertIsNotNone(ip)
        self.assertEqual(ip['id'], self.ip1.id)

    def test_match_character_by_name(self):
        """通过名称匹配角色"""
        result = match_metadata(
            '流萤 立牌',
            self.all_ips, self.all_characters, self.all_categories
        )
        chars = result.get('characters', [])
        char_ids = [c['id'] for c in chars]
        self.assertIn(self.char1.id, char_ids)

    def test_match_category_by_hint(self):
        """通过品类提示匹配"""
        result = match_metadata(
            '帕姆展览馆系列方形徽章',
            self.all_ips, self.all_characters, self.all_categories
        )
        cat = result.get('category')
        self.assertIsNotNone(cat)


# ── 预购定金单解析 ──────────────────────────────────────────────

def preorder_entry(text, y, x=205, score=0.98):
    """预购测试用条目（box 宽 240、高 30，y 为顶边）。"""
    return {'text': text, 'score': score, 'box': [x, y, x + 240, y + 30]}


def deposit_order_entries():
    """淘宝定金单订单详情截图（流萤粘土人手办）的真实 OCR 关键行。"""
    return [
        preorder_entry('环洲南路131号中澳春城14栋1902送货', 28),
        preorder_entry('齐笙86-133****3313', 100),
        preorder_entry('预售，2月21日20:02前发货', 184),
        preorder_entry('流萤系列+1', 271),
        preorder_entry('本系列收集进度2/4，还差2款', 309),
        preorder_entry('miHoYo旗舰店', 394),
        preorder_entry('【米哈游/崩坏：星穹铁道/定金', 495),
        preorder_entry('￥60', 507, x=575, score=0.863),
        preorder_entry('流萤粘土人手办miHoYo', 523),
        preorder_entry('【定金】', 556),
        preorder_entry('预定函预计12月到仓：流萤', 556, x=266),
        preorder_entry('X1', 583, x=595, score=0.695),
        preorder_entry('【预计2027年4月出货，到时需支付', 585),
        preorder_entry('尾款309元】', 611, x=188),
        preorder_entry('实付价￥60', 674, score=0.941),
        preorder_entry('商品总价', 806, x=29),
        preorder_entry('共1件', 807, x=139),
        preorder_entry('￥60', 805, x=564, score=0.8),
        preorder_entry('实付款', 877, x=27),
        preorder_entry('￥60', 871, x=531, score=0.83),
        preorder_entry('订单信息共5项', 967, x=31),
        preorder_entry('5127621876609013146|复制', 967, x=324, score=0.986),
        preorder_entry('凭据：8月5日下单交易快照', 1033, x=318),
    ]


class OcrPreorderParserTestCase(TestCase):
    """预购定金单解析（parse_preorder）"""

    def test_parse_preorder_full_deposit_order(self):
        """淘宝定金单截图：名称 / 定金 / 尾款 / 出货月 / 店铺 / 订单号 / 平台"""
        result = parse_preorder(deposit_order_entries())
        self.assertIsNotNone(result)
        self.assertEqual(result['name'], '流萤粘土人手办')
        self.assertEqual(result['deposit_amount'], '60')
        self.assertEqual(result['balance_amount'], '309')
        self.assertEqual(result['estimated_month'], '2027-04')
        self.assertEqual(result['time_granularity'], 'month')
        self.assertEqual(result['shop_name'], 'miHoYo旗舰店')
        self.assertEqual(result['order_no'], '5127621876609013146')
        self.assertEqual(result['platform'], '淘宝')
        self.assertEqual(result['warnings'], [])

    def test_parse_preorder_returns_none_without_deposit_hints(self):
        """非定金单（现货单）不进入预购解析"""
        entries = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('流萤粘土人手办', 200),
            preorder_entry('￥60', 200, x=620),
            preorder_entry('X1', 250, x=700),
            preorder_entry('商品总价', 400, x=30),
        ]
        self.assertIsNone(parse_preorder(entries))

    def test_parse_preorder_missing_balance_and_ship_time(self):
        """尾款 / 出货时间未知：留空并给出警告"""
        entries = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('【米哈游/崩坏：星穹铁道/定金', 200),
            preorder_entry('流萤粘土人手办miHoYo', 230),
            preorder_entry('【定金】', 260),
            preorder_entry('实付价￥60', 300),
            preorder_entry('商品总价', 500, x=29),
            preorder_entry('订单信息共5项', 600, x=31),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['name'], '流萤粘土人手办')
        self.assertEqual(result['deposit_amount'], '60')
        self.assertIsNone(result['balance_amount'])
        self.assertIsNone(result['estimated_month'])
        warnings = ' '.join(result['warnings'])
        self.assertIn('尾款金额', warnings)
        self.assertIn('预计补款时间', warnings)

    def test_parse_preorder_quarter_granularity(self):
        """季度出货文案 → quarter 粒度，存季度首月"""
        entries = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('【米哈游/崩坏：星穹铁道/定金', 200),
            preorder_entry('流萤粘土人手办miHoYo', 230),
            preorder_entry('【定金】', 260),
            preorder_entry('【预计2027年Q2出货，到时需支付', 290),
            preorder_entry('尾款309元】', 320),
            preorder_entry('实付价￥60', 350),
            preorder_entry('商品总价', 500, x=29),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['estimated_month'], '2027-04')
        self.assertEqual(result['time_granularity'], 'quarter')

    def test_parse_preorder_chinese_quarter_wording(self):
        """中文季度措辞（2027年4季度）不能被月份正则误当 4 月"""
        entries = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('【米哈游/崩坏：星穹铁道/定金', 200),
            preorder_entry('流萤粘土人手办miHoYo', 230),
            preorder_entry('【定金】', 260),
            preorder_entry('【预计2027年4季度出货，到时需支付', 290),
            preorder_entry('尾款309元】', 320),
            preorder_entry('实付价￥60', 350),
            preorder_entry('商品总价', 500, x=29),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['estimated_month'], '2027-10')
        self.assertEqual(result['time_granularity'], 'quarter')

    def test_parse_preorder_chinese_numeral_quarter(self):
        """中文数字季度（2027年第四季度）同样识别为季度"""
        entries = [
            preorder_entry('流萤粘土人手办', 100),
            preorder_entry('定金已付￥60', 130, x=30),
            preorder_entry('预计2027年第四季度出货', 160),
            preorder_entry('尾款：309元', 190),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['estimated_month'], '2027-10')
        self.assertEqual(result['time_granularity'], 'quarter')

    def test_parse_preorder_balance_date_not_mistaken(self):
        """「尾款：2027年4月15日」是日期不是尾款金额"""
        entries = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('流萤粘土人手办miHoYo', 200),
            preorder_entry('￥60', 200, x=620),
            preorder_entry('【定金】', 260),
            preorder_entry('尾款：2027年4月15日', 290),
            preorder_entry('实付价￥60', 350),
            preorder_entry('商品总价', 500, x=29),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertIsNone(result['balance_amount'])
        self.assertTrue(any('尾款金额' in w for w in result['warnings']))

    def test_parse_preorder_order_no_with_cjk_prefix(self):
        """「订单号5127…」无冒号分隔也能识别订单号，且订单号行不污染名称"""
        entries = [
            preorder_entry('流萤粘土人手办', 100),
            preorder_entry('定金已付￥60', 130, x=30),
            preorder_entry('尾款：309元', 160),
            preorder_entry('订单号5127621876609013146', 190),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['order_no'], '5127621876609013146')
        self.assertEqual(result['name'], '流萤粘土人手办')

    def test_parse_preorder_without_shop_line_window(self):
        """无店铺行时以首个价格为窗口起点，名称不取顶部横幅"""
        entries = [
            preorder_entry('流萤系列+1', 100),
            preorder_entry('本系列收集进度2/4，还差2款', 140),
            preorder_entry('【米哈游/崩坏：星穹铁道/定金', 200),
            preorder_entry('￥60', 200, x=620),
            preorder_entry('流萤粘土人手办miHoYo', 230),
            preorder_entry('【定金】', 260),
            preorder_entry('实付价￥60', 350),
            preorder_entry('商品总价', 500, x=29),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['name'], '流萤粘土人手办')
        self.assertEqual(result['deposit_amount'], '60')

    def test_parse_preorder_month_only_infers_year(self):
        """仅月份出货文案：推断年份（未来月用当年）"""
        entries = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('【米哈游/崩坏：星穹铁道/定金', 200),
            preorder_entry('流萤粘土人手办miHoYo', 230),
            preorder_entry('【定金】', 260),
            preorder_entry('预计12月到货，到时需支付', 290),
            preorder_entry('尾款309元】', 320),
            preorder_entry('实付价￥60', 350),
            preorder_entry('商品总价', 500, x=29),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        from datetime import date
        expected = f"{date.today().year}-12"
        self.assertEqual(result['estimated_month'], expected)
        self.assertEqual(result['time_granularity'], 'month')

    def test_parse_preorder_bilibili_platform(self):
        """会员购文案 → 平台推断为哔哩哔哩会员购"""
        entries = [
            preorder_entry('哔哩哔哩会员购', 60),
            preorder_entry('流萤粘土人手办', 100),
            preorder_entry('定金已付￥60', 130, x=30),
            preorder_entry('尾款：309元', 160),
            preorder_entry('预计出货：2027年4月', 190),
            preorder_entry('订单号：5127621876609013146', 220),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['platform'], '哔哩哔哩会员购')
        self.assertEqual(result['deposit_amount'], '60')
        self.assertEqual(result['balance_amount'], '309')
        self.assertEqual(result['estimated_month'], '2027-04')

    def test_parse_preorder_multiple_paid_prices_warns(self):
        """多个不同实付价 → 警告仅按第一条登记"""
        entries = deposit_order_entries() + [
            preorder_entry('实付价￥120', 700),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['deposit_amount'], '60')
        self.assertTrue(
            any('多个商品' in w for w in result['warnings']),
            result['warnings'],
        )

    def test_parse_preorder_name_cleans_brackets_and_brand(self):
        """名称清理：去括号组、去 ≥5 字符尾部品牌词"""
        entries = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('【特典版】流萤粘土人手办miHoYo', 200),
            preorder_entry('￥60', 200, x=620),
            preorder_entry('【定金】', 260),
            preorder_entry('实付价￥60', 300),
            preorder_entry('商品总价', 500, x=29),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['name'], '流萤粘土人手办')

    def test_parse_preorder_keeps_short_ascii_suffix(self):
        """短 ASCII 后缀（DX/EX 等版本标识）不得被当品牌词去除"""
        entries = [
            preorder_entry('流萤粘土人手办DX', 100),
            preorder_entry('定金已付￥60', 130, x=30),
            preorder_entry('尾款：309元', 160),
            preorder_entry('预计2027年4月出货', 190),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['name'], '流萤粘土人手办DX')

    def test_parse_preorder_paid_price_decimal_normalized(self):
        """'60' 与 '60.00' 视为同一实付价，不误报多商品"""
        entries = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('流萤粘土人手办miHoYo', 200),
            preorder_entry('￥60', 200, x=620),
            preorder_entry('【定金】', 260),
            preorder_entry('实付价￥60', 300),
            preorder_entry('实付款￥60.00', 350),
            preorder_entry('商品总价', 500, x=29),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertFalse(any('多个商品' in w for w in result['warnings']), result['warnings'])

    def test_parse_preorder_bilibili_pay_time(self):
        """会员购「尾款时间：2027-04-15」→ 预计补款月 2027-04"""
        entries = [
            preorder_entry('哔哩哔哩会员购', 60),
            preorder_entry('流萤粘土人手办', 100),
            preorder_entry('定金已付￥60', 130, x=30),
            preorder_entry('尾款：309元', 160),
            preorder_entry('尾款时间：2027-04-15 10:00', 190),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['estimated_month'], '2027-04')
        self.assertEqual(result['time_granularity'], 'month')

    def test_parse_preorder_platform_weak_signal_not_overriding_taobao(self):
        """淘宝文案含「付尾款时间」时不误判为哔哩哔哩会员购"""
        entries = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('流萤粘土人手办', 200),
            preorder_entry('￥60', 200, x=620),
            preorder_entry('【定金】', 260),
            preorder_entry('付尾款时间：2027-04-15', 300),
            preorder_entry('实付价￥60', 350),
            preorder_entry('订单信息 共 5 项', 500, x=29),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['platform'], '淘宝')

    def test_parse_preorder_platform_weak_signal_alone(self):
        """仅「尾款时间」且无淘宝特征时推断为哔哩哔哩会员购"""
        entries = [
            preorder_entry('流萤粘土人手办', 100),
            preorder_entry('定金已付￥60', 130, x=30),
            preorder_entry('尾款：309元', 160),
            preorder_entry('尾款时间：2027-04-15 10:00', 190),
        ]
        result = parse_preorder(entries)
        self.assertIsNotNone(result)
        self.assertEqual(result['platform'], '哔哩哔哩会员购')


class OcrPreorderApiTestCase(TestCase):
    """预购 OCR 接口（mode=preorder）"""

    def setUp(self):
        self.client = APIClient()
        role, _ = Role.objects.get_or_create(name='User')
        self.user = User.objects.create(username='ocr_preorder_user', password='pass', role=role)
        self.client.force_authenticate(user=self.user)
        # OCR 结果缓存按图片字节哈希共享，测试占位图字节相同会互相污染，须清空
        from django.core.cache import cache
        cache.clear()

    def _image_file(self):
        image = Image.new('RGB', (40, 40), 'white')
        buffer = BytesIO()
        image.save(buffer, format='JPEG')
        buffer.seek(0)
        buffer.name = 'order.jpg'
        return buffer

    @patch('apps.ocr.views._prepare_and_run_ocr')
    def test_recognize_mode_preorder(self, run_mock):
        """mode=preorder：返回 preorder 块"""
        run_mock.return_value = deposit_order_entries()
        response = self.client.post(
            '/api/ocr/recognize/',
            {'image': self._image_file(), 'mode': 'preorder'},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()['preorder']
        self.assertEqual(data['name'], '流萤粘土人手办')
        self.assertEqual(data['deposit_amount'], '60')
        self.assertEqual(data['balance_amount'], '309')
        self.assertEqual(data['estimated_month'], '2027-04')
        self.assertEqual(data['shop_name'], 'miHoYo旗舰店')
        self.assertEqual(data['order_no'], '5127621876609013146')
        self.assertEqual(data['platform'], '淘宝')

    @patch('apps.ocr.views._prepare_and_run_ocr')
    def test_recognize_mode_preorder_rejects_regular_order(self, run_mock):
        """mode=preorder 但截图非定金单 → 400"""
        run_mock.return_value = [
            preorder_entry('miHoYo旗舰店', 100),
            preorder_entry('流萤粘土人手办', 200),
            preorder_entry('￥60', 200, x=620),
            preorder_entry('X1', 250, x=700),
            preorder_entry('商品总价', 400, x=30),
        ]
        response = self.client.post(
            '/api/ocr/recognize/',
            {'image': self._image_file(), 'mode': 'preorder'},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

