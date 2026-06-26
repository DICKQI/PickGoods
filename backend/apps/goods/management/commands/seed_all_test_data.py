"""创建测试用的 IP、角色、品类及谷子数据（幂等，可重复运行）。"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.goods.models import Category, Character, Goods, IP, IPKeyword
from apps.users.models import Role, User


IP_SPECS = [
    ("崩坏：星穹铁道", 4, 10, ["星铁", "崩铁", "HSR", "Honkai Star Rail"]),
    ("原神", 4, 20, ["原神", "Genshin", "GI"]),
    ("咒术回战", 2, 30, ["咒回", "JJK", "Jujutsu Kaisen"]),
    ("葬送的芙莉莲", 2, 40, ["芙莉莲", "Frieren", "Sousou no Frieren"]),
]

CHARACTER_SPECS = [
    ("崩坏：星穹铁道", [
        ("流萤", "female"),
        ("花火", "female"),
        ("黄泉", "female"),
        ("丹恒", "male"),
        ("刃", "male"),
    ]),
    ("原神", [
        ("雷电将军", "female"),
        ("纳西妲", "female"),
        ("钟离", "male"),
        ("神里绫华", "female"),
    ]),
    ("咒术回战", [
        ("虎杖悠仁", "male"),
        ("五条悟", "male"),
        ("伏黑惠", "male"),
        ("钉崎野蔷薇", "female"),
    ]),
    ("葬送的芙莉莲", [
        ("芙莉莲", "female"),
        ("菲伦", "female"),
        ("休塔尔克", "male"),
        ("辛美尔", "male"),
    ]),
]

CATEGORY_SPECS = [
    ("吧唧", "round"),
    ("异形吧唧", None),
    ("金属徽章", "round"),
    ("亚克力立牌", None),
    ("摇摇乐", None),
    ("流沙摆件", None),
    ("色纸", "rectangle"),
    ("亚克力挂件", None),
    ("拍立得", "rectangle"),
    ("镭射票", "rectangle"),
    ("透卡", "rectangle"),
    ("小卡", "rectangle"),
    ("明信片", "rectangle"),
    ("棉花娃娃", None),
    ("团子", None),
    ("痛包", None),
    ("印章", None),
    ("胶带", None),
]

GOODS_SPECS = [
    ("星穹铁道 流萤 吧唧", "崩坏：星穹铁道", "吧唧", ["流萤"], 2, "25.00", "in_cabinet", True),
    ("星穹铁道 花火 色纸", "崩坏：星穹铁道", "色纸", ["花火"], 1, "35.00", "in_cabinet", True),
    ("星穹铁道 黄泉 立牌", "崩坏：星穹铁道", "亚克力立牌", ["黄泉"], 1, "89.00", "in_cabinet", True),
    ("星穹铁道 丹恒 吧唧", "崩坏：星穹铁道", "吧唧", ["丹恒"], 3, "22.00", "in_cabinet", True),
    ("星穹铁道 刃 镭射票", "崩坏：星穹铁道", "镭射票", ["刃"], 2, "15.00", "in_cabinet", True),
    ("原神 雷电将军 吧唧", "原神", "吧唧", ["雷电将军"], 1, "25.00", "in_cabinet", True),
    ("原神 纳西妲 立牌", "原神", "亚克力立牌", ["纳西妲"], 1, "79.00", "in_cabinet", True),
    ("原神 钟离 金属徽章", "原神", "金属徽章", ["钟离"], 2, "38.00", "in_cabinet", True),
    ("原神 神里绫华 透卡", "原神", "透卡", ["神里绫华"], 1, "12.00", "outdoor", True),
    ("原神 神里绫华 明信片", "原神", "明信片", ["神里绫华"], 5, "8.00", "in_cabinet", True),
    ("咒术回战 五条悟 吧唧", "咒术回战", "吧唧", ["五条悟"], 2, "28.00", "in_cabinet", True),
    ("咒术回战 虎杖悠仁 小卡", "咒术回战", "小卡", ["虎杖悠仁"], 3, "10.00", "in_cabinet", True),
    ("咒术回战 伏黑惠 拍立得", "咒术回战", "拍立得", ["伏黑惠"], 1, "18.00", "sold", True),
    ("咒术回战 钉崎野蔷薇 立牌", "咒术回战", "亚克力立牌", ["钉崎野蔷薇"], 1, "75.00", "draft", True),
    ("芙莉莲 芙莉莲 吧唧", "葬送的芙莉莲", "吧唧", ["芙莉莲"], 4, "25.00", "in_cabinet", True),
    ("芙莉莲 菲伦 摇摇乐", "葬送的芙莉莲", "摇摇乐", ["菲伦"], 2, "42.00", "in_cabinet", True),
    ("芙莉莲 休塔尔克 色纸", "葬送的芙莉莲", "色纸", ["休塔尔克"], 1, "30.00", "in_cabinet", True),
    ("芙莉莲 辛美尔 亚克力挂件", "葬送的芙莉莲", "亚克力挂件", ["辛美尔"], 1, "55.00", "outdoor", True),
    ("星穹铁道 流萤+花火 立牌", "崩坏：星穹铁道", "亚克力立牌", ["流萤", "花火"], 1, "128.00", "in_cabinet", False),
    ("原神 纳西妲 摇摇乐", "原神", "摇摇乐", ["纳西妲"], 1, "45.00", "in_cabinet", True),
]


class Command(BaseCommand):
    help = "创建测试用的 IP、角色、品类及谷子数据（幂等，可重复运行）。"

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin", help="谷子关联的用户名")
        parser.add_argument("--password", default=None, help="用户密码（用户不存在时创建用）")

    def _ensure_user(self, username, password):
        role, _ = Role.objects.get_or_create(name="User")
        admin_role, _ = Role.objects.get_or_create(name="Admin")
        user = User.objects.filter(username=username).first()
        if not user:
            if not password:
                self.stdout.write(self.style.ERROR(f"用户 {username} 不存在且未提供 --password，无法创建"))
                return None
            user = User(username=username, role=role, is_active=True)
            user.set_password(password)
            user.save()
            self.stdout.write(f"  + 用户: {username}")
        return user

    @transaction.atomic
    def handle(self, *args, **options):
        username = options.get("username") or "admin"
        password = options.get("password")

        user = self._ensure_user(username, password)
        if not user:
            return

        ip_created = ip_updated = 0
        for name, subject_type, order, keywords in IP_SPECS:
            ip, created = IP.objects.get_or_create(
                name=name,
                defaults={"subject_type": subject_type, "order": order},
            )
            if created:
                ip_created += 1
                self.stdout.write(f"  + IP: {name}")
            else:
                dirty = False
                if ip.subject_type is None and subject_type:
                    ip.subject_type = subject_type
                    dirty = True
                if ip.order == 0:
                    ip.order = order
                    dirty = True
                if dirty:
                    ip.save(update_fields=["subject_type", "order"])
                    ip_updated += 1
                self.stdout.write(f"    IP: {name} (已存在)")
            for kw in keywords:
                IPKeyword.objects.get_or_create(ip=ip, value=kw)

        char_created = 0
        for ip_name, chars in CHARACTER_SPECS:
            try:
                ip = IP.objects.get(name=ip_name)
            except IP.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"  跳过角色：IP {ip_name} 不存在"))
                continue
            for char_name, gender in chars:
                _, created = Character.objects.get_or_create(
                    ip=ip, name=char_name, defaults={"gender": gender},
                )
                if created:
                    char_created += 1
                    self.stdout.write(f"  + 角色: {ip_name} - {char_name}")

        cat_created = cat_updated = 0
        for name, shape_type in CATEGORY_SPECS:
            cat, created = Category.objects.get_or_create(
                name=name,
                defaults={"shape_type": shape_type, "path_name": name},
            )
            if created:
                cat_created += 1
                self.stdout.write(f"  + 品类: {name} (shape={shape_type})")
            elif not cat.shape_type and shape_type:
                cat.shape_type = shape_type
                cat.save(update_fields=["shape_type"])
                cat_updated += 1
                self.stdout.write(f"  ~ 品类: {name} -> shape={shape_type}")
            else:
                self.stdout.write(f"    品类: {name} (已存在)")

        goods_created = 0
        for g_name, ip_name, cat_name, char_names, qty, price, status, official in GOODS_SPECS:
            try:
                ip = IP.objects.get(name=ip_name)
            except IP.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"  跳过谷子 {g_name}：IP {ip_name} 不存在"))
                continue
            try:
                category = Category.objects.get(name=cat_name)
            except Category.DoesNotExist:
                self.stdout.write(self.style.WARNING(f"  跳过谷子 {g_name}：品类 {cat_name} 不存在"))
                continue

            chars = list(Character.objects.filter(ip=ip, name__in=char_names))
            if not chars:
                self.stdout.write(self.style.WARNING(f"  跳过谷子 {g_name}：角色 {char_names} 不存在"))
                continue

            goods, created = Goods.objects.get_or_create(
                name=g_name, user=user, ip=ip, category=category,
                defaults={
                    "quantity": qty,
                    "price": Decimal(price),
                    "status": status,
                    "is_official": official,
                },
            )
            if created:
                goods.characters.set(chars)
                goods_created += 1
                self.stdout.write(f"  + 谷子: {g_name} ({ip_name}/{cat_name})")

        self.stdout.write(self.style.SUCCESS(
            f"完成：IP +{ip_created}（更新 {ip_updated}），角色 +{char_created}，"
            f"品类 +{cat_created}（更新 {cat_updated}），谷子 +{goods_created}"
        ))
