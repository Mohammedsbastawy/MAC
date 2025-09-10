# لوجينج بسيط
import logging
import os
from logging.handlers import RotatingFileHandler
from collections import deque

# --- In-Memory Handler ---
class MemoryHandler(logging.Handler):
    """
    A logging handler that keeps the last N records in a deque.
    """
    def __init__(self, capacity=500):
        super().__init__()
        self.buffer = deque(maxlen=capacity)

    def emit(self, record):
        self.buffer.append(self.format(record))

# Create a single instance of the memory handler to be shared
memory_handler = MemoryHandler()


# --- File Handler Setup ---
# This script is in Tools/utils. The log file should be in Tools/
# We use an absolute path to be safe.
current_dir = os.path.dirname(os.path.abspath(__file__))
tools_dir = os.path.dirname(current_dir)
log_file_path = os.path.join(tools_dir, 'dominion-tools.log')

# إعداد الفورماتر
log_formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')

# Set formatter for both handlers
memory_handler.setFormatter(log_formatter)

# إعداد معالج الملفات مع تدوير الملفات
# 2 ميجابايت لكل ملف، مع الاحتفاظ بـ 5 ملفات قديمة
file_handler = RotatingFileHandler(log_file_path, maxBytes=2*1024*1024, backupCount=5, encoding='utf-8')
file_handler.setFormatter(log_formatter)

# إعداد معالج الكونسول
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)


# --- Configure the Root Logger ---
# We get the root logger for the 'Tools' package
logger = logging.getLogger('Tools')
logger.setLevel(logging.INFO)

# تجنب إضافة المعالجات إذا كانت موجودة بالفعل (مهم في بيئة فلاسك)
if not logger.handlers:
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    # We create a new custom handler for memory logging that formats records
    # before storing them in the deque. This is simpler.
    class FormattedMemoryHandler(logging.Handler):
        def __init__(self, capacity=500):
            super().__init__()
            # The buffer will store formatted strings
            self.buffer = deque(maxlen=capacity)

        def emit(self, record):
            # The record is formatted before being added to the buffer
            self.buffer.append(self.format(record))

    # Re-initialize the shared memory_handler instance with our new class
    # and set its formatter.
    memory_handler = FormattedMemoryHandler()
    memory_handler.setFormatter(log_formatter)

    logger.addHandler(memory_handler)

