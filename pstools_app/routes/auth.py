# مصادقة المستخدم أو التحقق من الأدمن
from flask import Blueprint, request, jsonify, session
import subprocess
import re

auth_bp = Blueprint('auth', __name__)

def check_is_domain_admin(username):
    """Checks if a user is a member of the Domain Admins group."""
    try:
        # Command to check group membership. Using 'net group' is more reliable.
        # The command needs to be run in a shell to correctly handle quotes.
        cmd = f'net group "Domain Admins" /domain'
        proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=30)

        if proc.returncode != 0:
            # This can happen if the command fails, e.g., not on a domain.
            return False, f"Failed to query Domain Admins group: {proc.stderr or proc.stdout}"

        # The output of 'net group' is structured with usernames listed under a header.
        # We need to parse it to find the username.
        output_lines = proc.stdout.strip().splitlines()
        
        # Find the start of the user list
        user_section_started = False
        user_list = []
        for line in output_lines:
            if "-------------------------------------------------------------------------------" in line:
                user_section_started = True
                continue
            if user_section_started:
                # Usernames can be in columns, so we split and filter empty strings
                user_list.extend(filter(None, line.strip().split('  ')))
        
        # Check if the provided username is in the list of domain admins.
        # The comparison should be case-insensitive.
        return any(username.lower() == admin.lower() for admin in user_list), None

    except subprocess.TimeoutExpired:
        return False, "The command to check for Domain Admins timed out."
    except Exception as e:
        return False, f"An unexpected error occurred: {str(e)}"

@auth_bp.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    
    if not re.match(r"^\S+@\S+\.\S+$", email):
        return jsonify({"ok": False, "error": "صيغة البريد الإلكتروني غير صحيحة."})

    username = email.split('@')[0]
    
    # For this application, we are not validating the password.
    # Instead, we are checking if the user is a Domain Admin.
    # The assumption is this app is run by an authorized user on a domain-joined machine.
    is_admin, error_msg = check_is_domain_admin(username)

    if not is_admin:
        error_to_show = error_msg or "المستخدم ليس لديه صلاحيات مسؤول على الشبكة (Domain Admin)."
        return jsonify({"ok": False, "error": error_to_show})

    # If the user is a domain admin, create a session for them.
    session.permanent = True  # Make the session last for a few days
    session['user'] = username
    session['email'] = email
    return jsonify({"ok": True, "user": username, "email": email})

@auth_bp.route('/api/check-session', methods=['GET'])
def api_check_session():
    if 'user' in session and 'email' in session:
        return jsonify({"ok": True, "user": session['user'], "email": session['email']})
    return jsonify({"ok": False})

@auth_bp.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"ok": True})
