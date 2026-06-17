"""创建默认品类并标注形状类型用于图片分类。"""
from django.core.management.base import BaseCommand
from apps.goods.models import Category


# (name, shape_type)
DEFAULT_CATEGORIES = [
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


class Command(BaseCommand):
    help = "创建默认品类并标注 shape_type。"

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for name, shape_type in DEFAULT_CATEGORIES:
            cat, was_created = Category.objects.get_or_create(
                name=name,
                defaults={"shape_type": shape_type, "path_name": name},
            )
            if was_created:
                created += 1
                self.stdout.write(f"  + {name} (shape_type={shape_type})")
            elif not cat.shape_type and shape_type:
                cat.shape_type = shape_type
                cat.save(update_fields=["shape_type"])
                updated += 1
                self.stdout.write(f"  ~ {name} -> shape_type={shape_type}")
            else:
                self.stdout.write(f"    {name} (已存在)")
        self.stdout.write(
            self.style.SUCCESS(f"完成：新增 {created}，更新 {updated} 条品类记录")
        )
