from datetime import date
from io import BytesIO
from unittest.mock import patch

from django.test import TestCase
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.goods.models import Category, Character, IP
from apps.ocr.parser import parse_ocr_items
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
