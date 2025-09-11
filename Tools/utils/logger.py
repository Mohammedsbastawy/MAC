# لوجينج بسيط
import logging
import os
from logging.handlers import RotatingFileHandler
from collections import deque

# This script is in Tools/utils. The log file should be in the parent Tools/ directory.
# We use an absolute path to be safe.
log_file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'atlas-tools.log'))

# --- Formatter ---
log_formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s.%(funcName)s: %(message)s')

# --- In-Memory Handler ---
class FormattedMemoryHandler(logging.Handler):
    """A logging handler that keeps the last N formatted records in a deque."""
    def __init__(self, capacity=500):
        super().__init__()
        self.buffer = deque(maxlen=capacity)

    def emit(self, record):
        # The record is formatted before being added to the buffer
        self.buffer.append(self.format(record))

# Create a single instance of the memory handler to be shared across the app
memory_handler = FormattedMemoryHandler()
memory_handler.setFormatter(log_formatter)


# --- File Handler Setup ---
# 2 MB per file, keep 5 old files
file_handler = RotatingFileHandler(log_file_path, maxBytes=2*1024*1024, backupCount=5, encoding='utf-8')
file_handler.setFormatter(log_formatter)

# --- Console Handler ---
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

# --- Configure the 'Tools' Logger ---
# This is the central logger for the entire application.
# Other modules should get this logger by name: logging.getLogger('Tools')
logger = logging.getLogger('Tools')
logger.setLevel(logging.DEBUG)

# Avoid adding handlers if they already exist (important in Flask's hot-reload environment)
if not logger.handlers:
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    logger.addHandler(memory_handler)

    
