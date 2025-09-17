from flask import Blueprint, jsonify, request, session
from Tools.utils.logger import logger
from Tools.utils.settings_manager import get_all_settings, save_settings, get_setting

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')

@settings_bp.before_request
def require_login():
    if 'user' not in session:
        logger.warning("Unauthorized access attempt to /api/settings.")
        return jsonify({'ok': False, 'error': 'Authentication required. Please log in.'}), 401

@settings_bp.route('/get-settings', methods=['GET'])
def api_get_settings():
    """
    API endpoint to fetch all current application settings.
    """
    try:
        settings = get_all_settings()
        return jsonify({'ok': True, 'settings': settings})
    except Exception as e:
        logger.error(f"Failed to get settings: {e}", exc_info=True)
        return jsonify({'ok': False, 'error': f"Failed to retrieve settings: {str(e)}"}), 500

@settings_bp.route('/save-settings', methods=['POST'])
def api_save_settings():
    """
    API endpoint to save new application settings.
    """
    data = request.get_json()
    if not data:
        return jsonify({'ok': False, 'error': 'No settings data provided.'}), 400

    logger.info(f"Received request to update settings: {data}")
    
    try:
        # Validate known settings before saving
        valid_settings = {}
        if 'log_retention_hours' in data:
            try:
                retention_hours = int(data['log_retention_hours'])
                if retention_hours > 0:
                    valid_settings['log_retention_hours'] = retention_hours
                else:
                    raise ValueError()
            except (ValueError, TypeError):
                return jsonify({'ok': False, 'error': 'Invalid value for log_retention_hours. Must be a positive number.'}), 400
        
        # Add more setting validations here as needed

        if not valid_settings:
            return jsonify({'ok': False, 'error': 'No valid settings to update.'}), 400

        save_settings(valid_settings)
        logger.info(f"Successfully saved new settings: {valid_settings}")
        return jsonify({'ok': True, 'message': 'Settings saved successfully.'})
    except Exception as e:
        logger.error(f"Failed to save settings: {e}", exc_info=True)
        return jsonify({'ok': False, 'error': f"Failed to save settings: {str(e)}"}), 500
