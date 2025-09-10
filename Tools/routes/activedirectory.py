# دوال التعامل مع Active Directory
from flask import Blueprint, request, jsonify, session
from datetime import datetime, timezone

try:
    from pyad import aduser, adcomputer, adquery, pyad_setdefaults
    from pyad.pyadexceptions import PyADError, PyADInvalidUser, PyADInvalidPassword
    PYAD_AVAILABLE = True
except ImportError:
    PYAD_AVAILABLE = False

ad_bp = Blueprint('activedirectory', __name__)

def format_datetime(dt_obj):
    """Formats a datetime object into a human-readable string."""
    if dt_obj and isinstance(dt_obj, datetime):
        # Convert to local timezone if it's timezone-aware
        if dt_obj.tzinfo:
            dt_obj = dt_obj.astimezone()
        return dt_obj.strftime("%Y-%m-%d %H:%M:%S")
    return "Never"


@ad_bp.before_request
def require_login():
    # حماية جميع مسارات AD
    if 'user' not in session or 'password' not in session or 'domain' not in session:
        return jsonify({'ok': False, 'error': 'يجب تسجيل الدخول أولاً'}), 401
    
    if not PYAD_AVAILABLE:
        return jsonify({
            'ok': False,
            'error': 'مكتبة pyad غير مثبتة على الخادم، لا يمكن تنفيذ استعلامات Active Directory.',
            'error_code': 'PYAD_NOT_FOUND'
        }), 500
    
    # Set pyad defaults for all AD routes
    username = session.get("user")
    password = session.get("password")
    domain = session.get("domain")
    user_principal_name = f"{username}@{domain}"
    try:
        pyad_setdefaults(username=user_principal_name, password=password)
    except PyADError as e:
        return jsonify({
            "ok": False, 
            "error": "Active Directory Authentication Failed",
            "message": f"Could not authenticate with domain '{domain}'. Please check credentials or DC connectivity.",
            "error_code": "AD_AUTH_FAILED",
            "details": str(e)
        }), 500


@ad_bp.route('/api/ad/get-computers', methods=['POST'])
def get_ad_computers():
    """
    Fetches all computer objects from Active Directory.
    """
    try:
        q = adquery.ADQuery()
        q.execute_query(
            attributes=["name", "dNSHostName", "operatingSystem", "lastLogonTimestamp", "whenCreated"],
            where_clause="objectCategory = 'computer'",
            base_dn="" # Search the entire domain
        )
        
        computers_list = []
        for row in q.get_results():
            # Convert the COM object timestamp to a Python datetime object
            last_logon_timestamp = row.get("lastLogonTimestamp")
            if last_logon_timestamp and hasattr(last_logon_timestamp, 'value'):
                 # The timestamp is the number of 100-nanosecond intervals since January 1, 1601.
                try:
                    last_logon_dt = datetime(1601, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=last_logon_timestamp.value / 10)
                except:
                    last_logon_dt = None # In case of conversion error
            else:
                last_logon_dt = None

            computers_list.append({
                "name": row.get("name"),
                "dns_hostname": row.get("dNSHostName"),
                "os": row.get("operatingSystem"),
                "last_logon": format_datetime(last_logon_dt),
                "created": format_datetime(row.get("whenCreated"))
            })

        return jsonify({"ok": True, "computers": computers_list})

    except PyADError as e:
        return jsonify({
            "ok": False, 
            "error": "Active Directory Query Failed",
            "message": f"An error occurred while trying to query Active Directory.",
            "error_code": "AD_QUERY_FAILED",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False, 
            "error": "Unexpected Error",
            "message": "An unexpected error occurred during the Active Directory query.",
            "error_code": "UNEXPECTED_ERROR",
            "details": str(e)
        }), 500


@ad_bp.route('/api/ad/set-user-password', methods=['POST'])
def set_user_password():
    """
    Sets the password for a target user in Active Directory.
    """
    data = request.get_json() or {}
    target_username = data.get('username')
    new_password = data.get('new_password')

    if not target_username or not new_password:
        return jsonify({'ok': False, 'error': 'Username and new password are required.'}), 400

    try:
        # Find the user
        target_user = aduser.ADUser.from_cn(target_username)
        
        # Set the password
        # The password must meet domain complexity requirements.
        # The user performing this action needs the necessary permissions in AD.
        target_user.set_password(new_password)

        return jsonify({'ok': True, 'message': f'Password for user "{target_username}" has been changed successfully.'})

    except PyADInvalidUser:
        return jsonify({'ok': False, 'error': f'User "{target_username}" not found in Active Directory.'}), 404
    except PyADInvalidPassword as e:
        # This can happen if the password does not meet complexity requirements
        return jsonify({'ok': False, 'error': 'Failed to set password.', 'details': str(e)}), 400
    except PyADError as e:
        # Catch other AD-related errors (e.g., permissions)
        return jsonify({'ok': False, 'error': 'An Active Directory error occurred.', 'details': str(e)}), 500
    except Exception as e:
        return jsonify({
            "ok": False, 
            "error": "Unexpected Error",
            "message": "An unexpected error occurred while setting the user password.",
            "error_code": "UNEXPECTED_ERROR",
            "details": str(e)
        }), 500
