# مصادقة المستخدم أو التحقق من الأدمن
from flask import Blueprint, request, jsonify, session
import subprocess
import re
import os

# We will check for pywin32 availability right when we need it.
# This makes the error messages more accurate.

auth_bp = Blueprint('auth', __name__)

def check_pywin32_availability():
    """Checks if pywin32 can be imported."""
    try:
        import win32security
        import win32con
        return True, None
    except ImportError as e:
        return False, str(e)
    except Exception as e:
        return False, str(e)

def check_is_domain_admin_with_cred(username, password, domain="."):
    """Checks credentials and domain admin status."""
    pywin32_ok, pywin32_error = check_pywin32_availability()
    if not pywin32_ok:
        # Fallback for non-windows environments or if pywin32 has issues
        if os.environ.get("FLASK_ENV") == "development":
             # Allow login in dev mode if pywin32 is not available
             return True, None
        return False, f"مكتبة pywin32 غير متوفرة أو فشلت في التهيئة. التفاصيل: {pywin32_error}"

    import win32security
    import win32con
    try:
        # 1. Authenticate user credentials
        hUser = win32security.LogonUser(
            username,
            domain,
            password,
            win32con.LOGON32_LOGON_NETWORK, # Use this for domain authentication
            win32con.LOGON32_PROVIDER_DEFAULT
        )
        
        # 2. Check if the user is a member of the "Domain Admins" group.
        is_admin, error_msg = check_is_domain_admin_group_member(f"{domain}\\{username}")
        
        hUser.Close()

        if error_msg:
             return False, f"تم التحقق من الحساب ولكن: {error_msg}"
        
        if not is_admin:
            return False, "تم التحقق من الحساب بنجاح، ولكن المستخدم ليس لديه صلاحيات مسؤول على الشبكة (Domain Admin)."

        return True, None

    except win32security.error as e:
        # Common error code for bad username/password is 1326
        if e.winerror == 1326:
            return False, "البريد الإلكتروني أو كلمة المرور غير صحيحة."
        return False, f"حدث خطأ أثناء المصادقة: {e}"
    except Exception as e:
        return False, f"An unexpected error occurred: {str(e)}"

def check_is_domain_admin_group_member(full_username):
    """Checks if a user is a member of the Domain Admins group using 'net group'."""
    try:
        user_to_check = full_username.split('\\')[-1]

        cmd = f'net group "Domain Admins" /domain'
        proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=30, creationflags=subprocess.CREATE_NO_WINDOW)

        if proc.returncode != 0:
            cmd = f'net localgroup "Administrators"'
            proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=30, creationflags=subprocess.CREATE_NO_WINDOW)
            if proc.returncode != 0:
                 return False, f"فشل الاستعلام عن مجموعة المدراء المحليين أو على النطاق: {proc.stderr or proc.stdout}"

        output_lines = proc.stdout.strip().splitlines()
        user_section_started = False
        user_list = []
        for line in output_lines:
            if "-------------------------------------------------------------------------------" in line:
                user_section_started = True
                continue
            if user_section_started:
                user_list.extend(filter(None, line.strip().split('  ')))
        
        return any(user_to_check.lower() == admin.lower() for admin in user_list), None

    except subprocess.TimeoutExpired:
        return False, "انتهت مهلة أمر التحقق من صلاحيات المدير."
    except Exception as e:
        return False, f"حدث خطأ غير متوقع: {str(e)}"


@auth_bp.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")
    
    if not re.match(r"^\S+@\S+\.\S+$", email):
        return jsonify({"ok": False, "error": "صيغة البريد الإلكتروني غير صحيحة."})

    if not password:
        return jsonify({"ok": False, "error": "كلمة المرور مطلوبة."})

    parts = email.split('@')
    username = parts[0]
    domain = parts[1] if len(parts) > 1 else "."

    is_admin, error_msg = check_is_domain_admin_with_cred(username, password, domain)

    if not is_admin:
        error_to_show = error_msg or "فشل تسجيل الدخول."
        return jsonify({"ok": False, "error": error_to_show})

    session.permanent = True
    session['user'] = username
    session['email'] = email
    session['domain'] = domain
    session['password'] = password
    return jsonify({"ok": True, "user": username, "email": email, "domain": domain})

@auth_bp.route('/api/check-session', methods=['GET'])
def api_check_session():
    if 'user' in session and 'email' in session:
        return jsonify({"ok": True, "user": session['user'], "email": session['email'], "domain": session.get('domain')})
    return jsonify({"ok": False})

@auth_p.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"ok": True})
