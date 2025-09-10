# لوجينج بسيط
import logging
import os
from logging.handlers import RotatingFileHandler

# مسار مجلد الأدوات
tools_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
log_file_path = os.path.join(tools_dir, 'dominion-tools.log')

# إعداد الفورماتر
log_formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')

# إعداد معالج الملفات مع تدوير الملفات
# 2 ميجابايت لكل ملف، مع الاحتفاظ بـ 5 ملفات قديمة
file_handler = RotatingFileHandler(log_file_path, maxBytes=2*1024*1024, backupCount=5, encoding='utf-8')
file_handler.setFormatter(log_formatter)

# إعداد معالج الكونسول
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

# الحصول على الـ logger الرئيسي للتطبيق
logger = logging.getLogger('Tools')
logger.setLevel(logging.INFO)

# تجنب إضافة المعالجات إذا كانت موجودة بالفعل (مهم في بيئة فلاسك)
if not logger.handlers:
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

