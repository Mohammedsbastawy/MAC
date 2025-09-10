import os
from flask import Blueprint, jsonify, session
from Tools.utils.logger import memory_handler

logs_bp = Blueprint('logs', __name__, url_prefix='/api/logs')


@logs_bp.before_request
def require_login():
    if 'user' not in session or 'email' not in session:
        return jsonify({'ok': False, 'error': 'Authentication required. Please log in.'}), 401

@logs_bp.route('/get-logs', methods=['GET'])
def get_logs():
    """
    Reads the logs directly from the in-memory handler.
    """
    try:
        # The memory_handler gives us a list of LogRecord objects.
        # We format them into strings before sending.
        log_messages = [memory_handler.formatter.format(record) for record in memory_handler.buffer]
        log_content = "\n".join(log_messages)
        
        if not log_content:
             # Check if the file handler has logs as a fallback for initial startup
             log_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dominion-tools.log')
             if os.path.exists(log_file):
                 with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
                    from collections import deque
                    lines = deque(f, 500)
                    log_content = "".join(lines)

        return jsonify({'ok': True, 'logs': log_content or "No log entries yet. Please perform some actions."})
        
    except Exception as e:
        return jsonify({'ok': False, 'error': f"Failed to retrieve logs from memory: {str(e)}"}), 500
