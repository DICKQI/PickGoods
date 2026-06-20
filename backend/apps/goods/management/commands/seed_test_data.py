"""创建测试用的 IP、角色、品类数据（幂等，可重复运行）。"""
from django.core.management.base import BaseCommand

from apps.goods.models import Category, Character, IP, IPKeyword


# (name, subject_type, order, [keywords])
# subject_type: 1=书籍, 2=动画, 3=音乐, 4=游戏, 6=三次元/特摄
IP_SPECS = [
    ("崩坏：星穹铁道", 4, 10, ["星铁", "崩铁", "HSR", "Honkai Star Rail"]),
    ("原神", 4, 20, ["原神", "Genshin", "GI"]),
    ("咒术回战", 2, 30, ["咒回", "JJK", "Jujutsu Kaisen"]),
    ("葬送的芙莉莲", 2, 40, ["芙莉莲", "Frieren", "Sousou no Frieren"]),
]

# (ip_name, [(char_name, gender), ...])  gender: male / female / other
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

# (name, shape_type) —— 扁平品类，补充现有树形品类
# shape_type: round（圆形吧唧类）/ rectangle（方形卡片类）/ None
CATEGORY_SPECS = [
    ("拍立得", "rectangle"),
    ("小卡", "rectangle"),
    ("镭射票", "rectangle"),
    ("透卡", "rectangle"),
    ("明信片", "rectangle"),
    ("亚克力挂件", None),
    ("流沙摆件", None),
]


class Command(BaseCommand):
    help = "创建测试用的 IP、角色、品类数据（幂等，可重复运行）。"

    def handle(self, *args, **options):
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
                    ip=ip,
                    name=char_name,
                    defaults={"gender": gender},
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

        self.stdout.write(self.style.SUCCESS(
            f"完成：IP +{ip_created}（更新 {ip_updated}），角色 +{char_created}，"
            f"品类 +{cat_created}（更新 {cat_updated}）"
        ))
