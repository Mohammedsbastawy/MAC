import os
from flask import Blueprint, jsonify, session

logs_bp = Blueprint('logs', __name__, url_prefix='/api/logs')

def get_log_file_path():
    """Returns the absolute path to the log file."""
    # This script is in Tools/routes. The log file is in Tools/
    current_dir = os.path.dirname(os.path.abspath(__file__))
    tools_dir = os.path.dirname(current_dir)
    return os.path.join(tools_dir, 'dominion-tools.log')


@logs_bp.before_request
def require_login():
    if 'user' not in session or 'email' not in session:
        return jsonify({'ok': False, 'error': 'Authentication required. Please log in.'}), 401

@logs_bp.route('/get-logs', methods=['GET'])
def get_logs():
    """
    Reads the last N lines from the log file and returns them.
    """
    log_file = get_log_file_path()
    num_lines = 500  # Number of lines to retrieve

    if not os.path.exists(log_file):
        return jsonify({'ok': True, 'logs': 'Log file not found. No logs to display yet.'})

    try:
        with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
            from collections import deque
            lines = deque(f, num_lines)
        
        log_content = "".join(lines)
        return jsonify({'ok': True, 'logs': log_content or "Log file is empty."})
        
    except Exception as e:
        return jsonify({'ok': False, 'error': f"Failed to read log file: {str(e)}"}), 500
