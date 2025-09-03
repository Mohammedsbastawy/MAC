# مصادقة المستخدم أو التحقق من الأدمن
from flask import Blueprint, request, jsonify, session
import subprocess
import re
import os

try:
    import win32security
    import win32con
    PYWIN32_AVAILABLE = True
except ImportError:
    PYWIN32_AVAILABLE = False


auth_bp = Blueprint('auth', __name__)

def check_is_domain_admin_with_cred(username, password, domain="."):
    """Checks credentials and domain admin status."""
    if not PYWIN32_AVAILABLE:
        # Fallback for non-windows environments - THIS WILL NOT WORK FOR PRODUCTION
        # We will assume success for local development if pywin32 is not installed
        if os.environ.get("FLASK_ENV") == "development":
             return True, None, "pywin32 not found, assuming success for dev"
        return False, "مكتبة pywin32 غير مثبتة على الخادم، لا يمكن التحقق من كلمة المرور.", password

    try:
        # 1. Authenticate user credentials
        hUser = win32security.LogonUser(
            username,
            domain,
            password,
            win32con.LOGON32_LOGON_NETWORK_CLEARTEXT, # Use this for network credentials
            win32con.LOGON32_PROVIDER_DEFAULT
        )
        # If LogonUser succeeds, credentials are valid.
        
        # 2. Check if the user is a member of the "Domain Admins" group.
        is_admin, error_msg = check_is_domain_admin_group_member(username)
        
        # Close the handle from LogonUser
        hUser.Close()

        if error_msg:
             # The user is authenticated, but we couldn't check admin status
             return False, f"تم التحقق من الحساب ولكن: {error_msg}", password
        
        if not is_admin:
            return False, "تم التحقق من الحساب بنجاح، ولكن المستخدم ليس لديه صلاحيات مسؤول على الشبكة (Domain Admin).", password

        return True, None, password

    except win32security.error as e:
        # Common error code for bad username/password is 1326
        if e.winerror == 1326:
            return False, "البريد الإلكتروني أو كلمة المرور غير صحيحة.", None
        return False, f"حدث خطأ أثناء المصادقة: {e}", None
    except Exception as e:
        return False, f"An unexpected error occurred: {str(e)}", None

def check_is_domain_admin_group_member(username):
    """Checks if a user is a member of the Domain Admins group using 'net group'."""
    try:
        # Use 'net group' which is reliable for checking domain group membership.
        cmd = f'net group "Domain Admins" /domain'
        proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=30, creationflags=subprocess.CREATE_NO_WINDOW)

        # The command can fail if the machine is not on a domain.
        # In that case, we fall back to checking the local Administrators group.
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
                # Users can be in columns, so we split by spaces and filter out empty strings
                user_list.extend(filter(None, line.strip().split('  ')))
        
        return any(username.lower() == admin.lower() for admin in user_list), None

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

    # Extract username and domain from email
    parts = email.split('@')
    username = parts[0]
    domain = parts[1] if len(parts) > 1 else "." # Use current domain if not specified

    is_admin, error_msg, stored_password = check_is_domain_admin_with_cred(username, password, domain)

    if not is_admin:
        error_to_show = error_msg or "فشل تسجيل الدخول."
        return jsonify({"ok": False, "error": error_to_show})

    # If the user is a domain admin and password is correct, create a session
    session.permanent = True
    session['user'] = username
    session['email'] = email
    # IMPORTANT: Store the password in the session for PsTools commands
    session['password'] = stored_password
    return jsonify({"ok": True, "user": username, "email": email})

@auth_bp.route('/api/check-session', methods=['GET'])
def api_check_session():
    if 'user' in session and 'email' in session:
        # Don't return the password to the client, but confirm session is ok
        return jsonify({"ok": True, "user": session['user'], "email": session['email']})
    return jsonify({"ok": False})

@auth_bp.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"ok": True})
