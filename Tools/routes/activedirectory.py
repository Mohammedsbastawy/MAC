# دوال التعامل مع Active Directory
from flask import Blueprint, request, jsonify, session
from datetime import datetime, timezone

# We will attempt the import within the routes themselves to ensure
# we catch any runtime initialization errors.

ad_bp = Blueprint('activedirectory', __name__)

def check_pyad_availability():
    """Checks if pyad can be imported and its core components are available."""
    try:
        # Import the necessary components
        from pyad import aduser, adcomputer, adquery, pyad_setdefaults, pyadexceptions
        return True, None
    except ImportError as e:
        # This catches if pyad or pywin32 is not installed at all
        return False, str(e)
    except Exception as e:
        # Catch other potential init errors, though less likely
        return False, f"An unexpected error occurred during pyad initialization. Details: {str(e)}"

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
    
    # 2. Check if pyad library is available just before setting defaults
    pyad_ok, pyad_error = check_pyad_availability()
    if not pyad_ok:
        return jsonify({
            'ok': False,
            'error': 'The pyad library is required for Active Directory queries but failed to import or initialize on the server.',
            'error_code': 'PYAD_INIT_FAILED',
            'details': f"The pyad python library could not be used. Please ensure it and its dependencies (like pywin32) are installed and configured correctly. Details: {pyad_error}"
        }), 500
    
    # 3. Retrieve credentials from the session
    username = session.get("user")
    password = session.get("password")
    domain = session.get("domain")
    
    # This is the format pyad expects for the username
    user_principal_name = f"{username}@{domain}"
    
    # Import here since we know the library is available
    from pyad import pyad_setdefaults
    from pyad import pyadexceptions

    try:
        # 4. Set the credentials for all subsequent pyad calls in this request.
        pyad_setdefaults(username=user_principal_name, password=password)
        
    except pyadexceptions.PyADError as e:
        # This will catch authentication/connection errors from pyad_setdefaults
        return jsonify({
            "ok": False, 
            "error": "Active Directory Authentication Failed",
            "message": f"Could not authenticate with domain '{domain}' using the provided credentials. Please check the username, password, or Domain Controller connectivity.",
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
    """
    # The before_request handler already checked for pyad availability and set credentials.
    from pyad import adquery, pyadexceptions

    try:
        q = adquery.ADQuery()
        q.execute_query(
            attributes=["name", "dNSHostName", "operatingSystem", "lastLogonTimestamp", "whenCreated"],
            where_clause="objectCategory = 'computer'",
            base_dn="" # Search the entire domain
        )
        
        computers_list = []
        for row in q.get_results():
            last_logon_timestamp = row.get("lastLogonTimestamp")
            if last_logon_timestamp and hasattr(last_logon_timestamp, 'value'):
                try:
                    # The timestamp is the number of 100-nanosecond intervals since January 1, 1601.
                    # To convert to a datetime object, we need to add this delta to the base date.
                    last_logon_dt = datetime(1601, 1, 1, tzinfo=timezone.utc) + timezone.timedelta(microseconds=last_logon_timestamp.value / 10)
                except:
                    last_logon_dt = None
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

    except pyadexceptions.PyADError as e:
        return jsonify({
            "ok": False, 
            "error": "Active Directory Query Failed",
            "message": "An error occurred while trying to query Active Directory. This can be due to insufficient permissions or connectivity issues.",
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
    """
    # The before_request handler already checked for pyad availability and set credentials.
    from pyad import aduser, pyadexceptions

    data = request.get_json() or {}
    target_username = data.get('username')
    new_password = data.get('new_password')

    if not target_username or not new_password:
        return jsonify({'ok': False, 'error': 'Target username and new password are required.'}), 400

    try:
        target_user = aduser.ADUser.from_cn(target_username)
        target_user.set_password(new_password)

        return jsonify({'ok': True, 'message': f'Password for user "{target_username}" has been changed successfully.'})

    except pyadexceptions.PyADInvalidUser as e:
        return jsonify({'ok': False, 'error': f'User "{target_username}" not found in Active Directory.', 'details': str(e)}), 404
    except pyadexceptions.PyADInvalidPassword as e:
        return jsonify({
            'ok': False, 
            'error': 'Failed to set password due to domain policy.',
            'message': 'The new password likely does not meet the complexity, length, or history requirements of the domain.',
            'error_code': 'AD_INVALID_PASSWORD_POLICY',
            'details': str(e)
        }), 400
    except pyadexceptions.PyADError as e:
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