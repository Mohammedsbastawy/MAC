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
        return False, "مكتبة pywin32 غير مثبتة على الخادم، لا يمكن التحقق من كلمة المرور."

    try:
        # 1. Authenticate user credentials
        hUser = win32security.LogonUser(
            username,
            domain,
            password,
            win32con.LOGON32_LOGON_NETWORK,
            win32con.LOGON32_PROVIDER_DEFAULT
        )
        # If LogonUser succeeds, credentials are valid.
        
        # 2. Check if the user is a member of the "Domain Admins" group.
        # Note: For local admins, use win32security.LookupAccountName("", "Administrators")
        # For domain, you might need more complex ADSI logic if the simple check fails.
        # This check works for the local "Administrators" group and may work for Domain Admins
        # depending on the context the server is running in.
        
        # We will use the 'net group' command as it's more reliable for domain checks
        # and doesn't require the server itself to be a domain controller.
        is_admin, error_msg = check_is_domain_admin_group_member(username)
        
        # Close the handle from LogonUser
        hUser.Close()

        if error_msg:
             # The user is authenticated, but we couldn't check admin status
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

def check_is_domain_admin_group_member(username):
    """Checks if a user is a member of the Domain Admins group using 'net group'."""
    try:
        # Use 'net group' which is reliable for checking domain group membership.
        cmd = f'net group "Domain Admins" /domain'
        proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=30)

        if proc.returncode != 0:
            # Fallback for non-domain environments or if the command fails
            # Check local administrators group instead
            cmd = f'net localgroup "Administrators"'
            proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=30)
            if proc.returncode != 0:
                 return False, f"فشل الاستعلام عن مجموعة المدراء: {proc.stderr or proc.stdout}"

        output_lines = proc.stdout.strip().splitlines()
        user_section_started = False
        user_list = []
        for line in output_lines:
            if "-------------------------------------------------------------------------------" in line:
                user_section_started = True
                continue
            if user_section_started:
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

    # For this application, we check if the user is a Domain Admin
    # AND verify their password.
    is_admin, error_msg = check_is_domain_admin_with_cred(username, password, domain)

    if not is_admin:
        error_to_show = error_msg or "فشل تسجيل الدخول."
        return jsonify({"ok": False, "error": error_to_show})

    # If the user is a domain admin and password is correct, create a session
    session.permanent = True
    session['user'] = username
    session['email'] = email
    return jsonify({"ok": True, "user": username, "email": email})

@auth_p.route('/api/check-session', methods=['GET'])
def api_check_session():
    if 'user' in session and 'email' in session:
        return jsonify({"ok": True, "user": session['user'], "email": session['email']})
    return jsonify({"ok": False})

@auth_bp.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"ok": True})
