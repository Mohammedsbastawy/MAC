# مصادقة المستخدم أو التحقق من الأدمن
from flask import Blueprint, request, jsonify, session

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/validate-admin-email', methods=['POST'])
def api_validate_admin_email():
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    pwd = data.get("pass", "")
    import re
    # تحقق من الصيغة
    if not re.match(r"^\S+@\S+\.\S+$", email):
        return jsonify({"ok": False, "error": "صيغة الإيميل غير صحيحة"})
    try:
        import subprocess
        username = email.split('@')[0]
        # تحقق من عضوية Domain Admins عبر net group
        cmd = ['net', 'group', '"Domain Admins"', '/domain']
        proc = subprocess.run(' '.join(cmd), capture_output=True, text=True, shell=True)
        out = proc.stdout.lower()
        if proc.returncode != 0:
            return jsonify({"ok": False, "error": "تعذر جلب مجموعة Domain Admins: " + proc.stderr})
        if username.lower() in out:
            session.permanent = True
            session['user'] = username
            session['email'] = email
            return jsonify({"ok": True})
        return jsonify({"ok": False, "error": "المستخدم ليس أدمن على الشبكة (Domain Admins)"})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)})

@auth_bp.route('/api/check-session', methods=['GET'])
def api_check_session():
    if 'user' in session and 'email' in session:
        return jsonify({"ok": True, "user": session['user'], "email": session['email']})
    return jsonify({"ok": False})

@auth_bp.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"ok": True})
