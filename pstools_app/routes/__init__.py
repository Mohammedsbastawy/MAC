# ملف تهيئة حزمة routes
from flask import Flask
from datetime import timedelta
from .network import network_bp
from .pstools import pstools_bp
from .auth import auth_bp
import os

def create_app():
    app = Flask(__name__)
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-me-please")
    app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
    app.register_blueprint(network_bp)
    app.register_blueprint(pstools_bp)
    app.register_blueprint(auth_bp)

    @app.route("/")
    def index():
        return "PsTools Flask Backend is running."

    return app
