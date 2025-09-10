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
def require_login_and_set_ad_credentials():
    # 1. Check if user is logged in
    if 'user' not in session or 'password' not in session or 'domain' not in session:
        return jsonify({'ok': False, 'error': 'Authentication required. Please log in first.', 'error_code': 'AUTH_REQUIRED'}), 401
    
    # 2. Check if pyad library is available
    if not PYAD_AVAILABLE:
        return jsonify({
            'ok': False,
            'error': 'The pyad library is not installed on the server, which is required for Active Directory queries.',
            'error_code': 'PYAD_NOT_FOUND'
        }), 500
    
    # 3. Retrieve credentials from the session
    username = session.get("user")
    password = session.get("password")
    domain = session.get("domain")
    
    # This is the format pyad expects for the username
    user_principal_name = f"{username}@{domain}"
    
    try:
        # 4. Set the credentials for all subsequent pyad calls in this request.
        # This is the critical step that authenticates with the Domain Controller.
        pyad_setdefaults(username=user_principal_name, password=password)
        
    except PyADError as e:
        # This will catch authentication/connection errors from pyad_setdefaults
        return jsonify({
            "ok": False, 
            "error": "Active Directory Authentication Failed",
            "message": f"Could not authenticate with domain '{domain}' using the provided credentials. Please check the username and password, or Domain Controller connectivity.",
            "error_code": "AD_AUTH_FAILED",
            "details": str(e)
        }), 401 # Use 401 for authentication failure
    except Exception as e:
        # Catch any other unexpected error during initialization
         return jsonify({
            "ok": False, 
            "error": "Unexpected Active Directory Initialization Error",
            "message": "An unexpected error occurred while initializing the Active Directory connection.",
            "error_code": "AD_INIT_UNEXPECTED_ERROR",
            "details": str(e)
        }), 500


@ad_bp.route('/api/ad/get-computers', methods=['POST'])
def get_ad_computers():
    """
    Fetches all computer objects from Active Directory.
    Credentials are set by the 'require_login_and_set_ad_credentials' before_request hook.
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
            "message": f"An error occurred while trying to query Active Directory. This can be due to insufficient permissions or connectivity issues.",
            "error_code": "AD_QUERY_FAILED",
            "details": str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False, 
            "error": "Unexpected Error During Query",
            "message": "An unexpected error occurred during the Active Directory computer query.",
            "error_code": "AD_QUERY_UNEXPECTED_ERROR",
            "details": str(e)
        }), 500


@ad_bp.route('/api/ad/set-user-password', methods=['POST'])
def set_user_password():
    """
    Sets the password for a target user in Active Directory.
    Credentials are set by the 'require_login_and_set_ad_credentials' before_request hook.
    """
    data = request.get_json() or {}
    target_username = data.get('username')
    new_password = data.get('new_password')

    if not target_username or not new_password:
        return jsonify({'ok': False, 'error': 'Target username and new password are required.'}), 400

    try:
        # Find the user by their sAMAccountName
        target_user = aduser.ADUser.from_cn(target_username)
        
        # Set the password. The password must meet domain complexity requirements.
        # The logged-in user needs the necessary permissions in AD to change other users' passwords.
        target_user.set_password(new_password)

        return jsonify({'ok': True, 'message': f'Password for user "{target_username}" has been changed successfully.'})

    except PyADInvalidUser:
        return jsonify({'ok': False, 'error': f'User "{target_username}" not found in Active Directory.'}), 404
    except PyADInvalidPassword as e:
        # This can happen if the new password does not meet complexity requirements
        return jsonify({
            'ok': False, 
            'error': 'Failed to set password due to domain policy.',
            'message': 'The new password likely does not meet the complexity, length, or history requirements of the domain.',
            'error_code': 'AD_INVALID_PASSWORD_POLICY',
            'details': str(e)
        }), 400
    except PyADError as e:
        # Catch other AD-related errors (e.g., insufficient permissions)
        return jsonify({
            'ok': False, 
            'error': 'Active Directory Error', 
            'message': 'An Active Directory error occurred. This could be due to insufficient permissions to change the password for this user.',
            'error_code': 'AD_GENERIC_ERROR',
            'details': str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False, 
            "error": "Unexpected Error",
            "message": "An unexpected error occurred while setting the user password.",
            "error_code": "UNEXPECTED_ERROR",
            "details": str(e)
        }), 500

    