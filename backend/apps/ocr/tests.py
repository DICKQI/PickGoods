from datetime import date
from io import BytesIO
from unittest.mock import patch

from django.db import models
from django.test import TestCase
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.goods.models import Category, Character, IP
from apps.ocr.parser import parse_ocr_items, parse_ocr_results, match_metadata, _extract_order_date, _extract_shop_name, _clean_ocr_name, _compact_name
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

