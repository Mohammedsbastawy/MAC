import os
from flask import Blueprint, jsonify, session
from Tools.utils.logger import logger, memory_handler

logs_bp = Blueprint('logs', __name__, url_prefix='/api/logs')


@logs_bp.before_request
def require_login():
    if 'user' not in session or 'email' not in session:
        logger.warning("Unauthorized access attempt to /api/logs.")
        return jsonify({'ok': False, 'error': 'Authentication required. Please log in.'}), 401

@logs_bp.route('/get-logs', methods=['GET'])
def get_logs():
    """
    Reads the logs directly from the in-memory handler.
    If the memory handler is empty, it attempts to read from the log file as a fallback.
    """
    try:
        # The memory_handler buffer now stores formatted string records directly.
        log_messages = list(memory_handler.buffer)
        log_content = "\n".join(log_messages)
        
        # Fallback to file if memory is empty, which can happen on first load or after a restart.
        if not log_content:
             logger.info("In-memory log buffer is empty, attempting to read from log file as a fallback.")
             log_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'atlas-tools.log'))
             if os.path.exists(log_file):
                 try:
                     with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
                        from collections import deque
                        # Read the last 500 lines of the file
                        lines = deque(f, 500) 
                        log_content = "".join(lines)
                 except Exception as e:
                     logger.error(f"Error reading from fallback log file: {e}")
                     # Don't overwrite log_content, it's fine if it remains empty

        return jsonify({'ok': True, 'logs': log_content or "No log entries yet. Please perform some actions."})
        
    except Exception as e:
        logger.error(f"Failed to retrieve logs: {e}", exc_info=True)
        return jsonify({'ok': False, 'error': f"Failed to retrieve logs: {str(e)}"}), 500

    
