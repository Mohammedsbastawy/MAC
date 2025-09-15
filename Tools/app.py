# ملف التشغيل الرئيسي لتطبيق Flask
from Tools.routes import create_app

app = create_app()

if __name__ == "__main__":
    # Enabling threaded mode to handle concurrent requests and prevent UI freezes.
    app.run(host="0.0.0.0", port=5000, debug=True, threaded=True)