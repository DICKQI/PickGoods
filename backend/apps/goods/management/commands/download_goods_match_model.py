import hashlib
import os
import tempfile
import urllib.request
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from apps.goods.image_match.config import (
    MODEL_SHA256,
    MODEL_SIZE,
    get_model_path,
    get_model_url,
)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class Command(BaseCommand):
    help = "下载并校验量化 DINOv2-small ONNX 图片匹配模型。"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="文件已存在时也重新下载",
        )

    def handle(self, *args, **options):
        destination = get_model_path()
        if destination.is_file() and not options["force"]:
            if destination.stat().st_size == MODEL_SIZE and _sha256(destination) == MODEL_SHA256:
                self.stdout.write(self.style.SUCCESS(f"模型已存在且校验通过：{destination}"))
                return
            raise CommandError("现有模型文件校验失败，请使用 --force 重新下载")

        destination.parent.mkdir(parents=True, exist_ok=True)
        self.stdout.write(f"正在下载模型：{get_model_url()}")
        temporary_path = None
        try:
            with urllib.request.urlopen(get_model_url(), timeout=120) as response:
                with tempfile.NamedTemporaryFile(
                    mode="wb",
                    dir=destination.parent,
                    prefix=".model-",
                    suffix=".tmp",
                    delete=False,
                ) as temporary:
                    temporary_path = Path(temporary.name)
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        temporary.write(chunk)
            if temporary_path.stat().st_size != MODEL_SIZE:
                raise CommandError("下载文件大小与固定版本不一致")
            digest = _sha256(temporary_path)
            if digest != MODEL_SHA256:
                raise CommandError("下载文件 SHA-256 校验失败")
            os.replace(temporary_path, destination)
        except CommandError:
            raise
        except Exception as exc:  # noqa: BLE001 - 网络错误统一转为命令错误
            raise CommandError(f"模型下载失败：{exc}") from exc
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink(missing_ok=True)

        self.stdout.write(self.style.SUCCESS(f"模型下载完成：{destination}"))
