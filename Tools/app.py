# ملف التشغيل الرئيسي لتطبيق Flask
from Tools.routes import create_app
from Tools.utils.logger import logger

app = create_app()

if __name__ == "__main__":
    # Enabling threaded mode to handle concurrent requests.
    logger.info("Starting Flask development server...")
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True, use_reloader=False)
