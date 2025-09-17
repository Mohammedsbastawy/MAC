import json
import os
from Tools.utils.logger import logger

# --- Configuration File ---
CONFIG_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'config.json'))

# --- Default Settings ---
DEFAULT_SETTINGS = {
    'log_retention_hours': 168  # Default to 7 days
}

def _ensure_config_file():
    """Ensures the configuration file exists, creating it with defaults if not."""
    if not os.path.exists(CONFIG_FILE):
        logger.warning(f"Configuration file not found at {CONFIG_FILE}. Creating with default values.")
        try:
            with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
                json.dump(DEFAULT_SETTINGS, f, indent=2)
            logger.info("Default configuration file created successfully.")
        except IOError as e:
            logger.error(f"FATAL: Could not create configuration file: {e}")
            # If we can't create the config, we should not proceed.
            raise

def get_all_settings():
    """
    Reads all settings from the config.json file.
    Returns a dictionary of settings.
    """
    _ensure_config_file()
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            # Merge with defaults to ensure all keys are present
            return {**DEFAULT_SETTINGS, **settings}
    except (IOError, json.JSONDecodeError) as e:
        logger.error(f"Could not read or parse config file {CONFIG_FILE}. Using default settings. Error: {e}")
        return DEFAULT_SETTINGS

def get_setting(key, default_value=None):
    """
    Reads a specific setting by key from the config.json file.
    """
    settings = get_all_settings()
    return settings.get(key, default_value if default_value is not None else DEFAULT_SETTINGS.get(key))

def save_settings(new_settings):
    """
    Updates the config.json file with new settings.
    new_settings is a dictionary of settings to update.
    """
    _ensure_config_file()
    current_settings = get_all_settings()
    current_settings.update(new_settings)
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(current_settings, f, indent=2)
        logger.info(f"Settings updated in {CONFIG_FILE}")
    except IOError as e:
        logger.error(f"Could not write to config file {CONFIG_FILE}: {e}")
        raise
