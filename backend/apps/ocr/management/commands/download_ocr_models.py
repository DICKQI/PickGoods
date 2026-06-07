"""预下载 PaddleOCR 模型，避免首次请求超时。"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "预下载 PaddleOCR PP-OCRv4 mobile 检测/识别模型。"

    def handle(self, *args, **options):
        self.stdout.write("正在初始化 PaddleOCR（首次将下载 PP-OCRv4 mobile 检测/识别模型）...")
        try:
            from paddleocr import PaddleOCR
            ocr = PaddleOCR(
                lang='ch',
                ocr_version='PP-OCRv4',
                use_textline_orientation=False,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                text_det_limit_side_len=1280,
                text_recognition_batch_size=16,
            )
            del ocr
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"模型下载失败: {e}"))
            return

        self.stdout.write(self.style.SUCCESS("PaddleOCR 模型下载完成"))
