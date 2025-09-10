# دوال التعامل مع Active Directory باستخدام ldap3
from flask import Blueprint, request, jsonify, session
from datetime import datetime, timezone
from Tools.utils.logger import logger

# We will use ldap3 which is cross-platform
# We will attempt the import within the routes themselves to ensure
# we catch any runtime initialization errors.

ad_bp = Blueprint('activedirectory', __name__)

def check_ldap3_availability():
    """Checks if ldap3 can be imported."""
    try:
        from ldap3 import Server, Connection, ALL, NTLM, Tls, SASL, KERBEROS, SIMPLE
        import ssl
        return True, None
    except ImportError as e:
        logger.error(f"ldap3 library is missing: {e}")
        return False, f"The ldap3 library is missing. Please install it using 'pip install ldap3'. Details: {str(e)}"
    except Exception as e:
        logger.error(f"Unexpected error during ldap3 initialization: {e}")
        return False, f"An unexpected error occurred during ldap3 initialization. Details: {str(e)}"

def format_datetime(dt_obj):
    """Formats a datetime object into a human-readable string."""
    if dt_obj and isinstance(dt_obj, datetime):
        if dt_obj.tzinfo:
            dt_obj = dt_obj.astimezone()
        return dt_obj.strftime("%Y-%m-%d %H:%M:%S")
    return "Never"

def get_ldap_connection():
    """
    Establishes and binds an LDAP connection using credentials from the session.
    Returns (Connection object, error_dict, http_status_code).
    """
    ldap3_ok, ldap3_error = check_ldap3_availability()
    if not ldap3_ok:
        return None, {'ok': False, 'error': 'LDAP3 Library Not Available', 'message': ldap3_error, 'error_code': 'LDAP3_INIT_FAILED'}, 500

    if 'user' not in session or 'password' not in session or 'domain' not in session or 'email' not in session:
        logger.warning("get_ldap_connection failed: Authentication required.")
        return None, {'ok': False, 'error': 'Authentication required. Please log in first.', 'error_code': 'AUTH_REQUIRED'}, 401

    from ldap3 import Server, Connection, ALL, SIMPLE, Tls
    import ssl

    user_principal_name = session.get("email")
    password = session.get("password")
    domain = session.get("domain")
    
    logger.info(f"Attempting LDAP connection to domain '{domain}' with user '{user_principal_name}'.")
    conn = None
    last_error = None
    
    # Attempt 1: Connect with SSL (LDAPS)
    try:
        logger.info("Trying LDAPS on port 636...")
        tls_config = Tls(validate=ssl.CERT_NONE, version=ssl.PROTOCOL_TLS)
        server = Server(domain, get_info=ALL, use_ssl=True, port=636, tls=tls_config)
        conn = Connection(server, user=user_principal_name, password=password, authentication=SIMPLE, auto_bind=True)
        if conn.bound:
             logger.info("LDAPS connection successful.")
    except Exception as e:
        last_error = str(e)
        logger.warning(f"LDAPS connection failed: {last_error}")
        conn = None
    
    # Attempt 2: If SSL failed, connect without SSL (standard LDAP)
    if not conn or not conn.bound:
        try:
            logger.info("LDAPS failed, trying standard LDAP on port 389...")
            server = Server(domain, get_info=ALL, port=389)
            conn = Connection(server, user=user_principal_name, password=password, authentication=SIMPLE, auto_bind=True)
            if conn.bound:
                logger.info("Standard LDAP connection successful.")
        except Exception as e:
            last_error = str(e)
            logger.warning(f"Standard LDAP connection failed: {last_error}")
            conn = None

    # Check the final result
    if conn and conn.bound:
        return conn, None, 200
    else:
        logger.error(f"LDAP bind failed for domain '{domain}'. Last error: {last_error}")
        return None, {
            'ok': False,
            'error': 'LDAP Connection Failed',
            'message': f"Could not bind to the domain '{domain}' with either SSL or non-SSL methods. Please check credentials and domain controller connectivity.",
            'details': f"Last encountered error: {last_error or 'No specific error message was captured.'}",
            'error_code': 'LDAP_BIND_FAILED'
        }, 401

def _get_ad_computers_data():
    """
    Internal function that fetches all computer objects from Active Directory
    and returns a Python dictionary. It does not return a Flask response.
    """
    logger.info("Fetching computer data from Active Directory.")
    conn, error, status = get_ldap_connection()
    if error:
        return error

    try:
        base_dn = conn.server.info.other.get('defaultNamingContext')[0]
        user_domain = session.get("domain", "Unknown")
        
        search_filter = "(objectCategory=computer)"
        attributes = ["name", "dNSHostName", "operatingSystem", "lastLogonTimestamp", "whenCreated"]
        
        logger.info(f"Searching AD with base DN '{base_dn}' and filter '{search_filter}'.")
        conn.search(search_base=base_dn,
                    search_filter=search_filter,
                    attributes=attributes)
        
        computers_list = []
        for entry in conn.entries:
            last_logon_timestamp = entry.lastLogonTimestamp.value
            last_logon_dt = None

            # Correctly handle lastLogonTimestamp which can be an int or a datetime object
            if last_logon_timestamp:
                if isinstance(last_logon_timestamp, datetime):
                    last_logon_dt = last_logon_timestamp
                elif isinstance(last_logon_timestamp, (int, float)) and int(last_logon_timestamp) > 0:
                    try:
                        # Value is in 100-nanosecond intervals since Jan 1, 1601
                        last_logon_dt = datetime(1601, 1, 1, tzinfo=timezone.utc) + timezone.timedelta(microseconds=last_logon_timestamp / 10)
                    except Exception:
                        last_logon_dt = None # Reset on error
                
            computers_list.append({
                "name": str(entry.name.value) if entry.name.value else "",
                "dns_hostname": str(entry.dNSHostName.value) if entry.dNSHostName.value else "",
                "os": str(entry.operatingSystem.value) if entry.operatingSystem.value else "",
                "last_logon": format_datetime(last_logon_dt),
                "created": format_datetime(entry.whenCreated.value),
                "domain": user_domain
            })
        
        logger.info(f"Found {len(computers_list)} computer objects in AD.")
        return {"ok": True, "computers": computers_list}

    except Exception as e:
        logger.error(f"Unexpected error during AD computer query: {e}", exc_info=True)
        return {
            "ok": False, 
            "error": "Unexpected LDAP Query Error",
            "message": "An unexpected error occurred during the Active Directory computer query.",
            "error_code": "AD_QUERY_UNEXPECTED_ERROR",
            "details": str(e)
        }
    finally:
        if conn:
            conn.unbind()
            logger.info("LDAP connection unbound.")


@ad_bp.route('/api/ad/get-computers', methods=['POST'])
def get_ad_computers():
    """
    API endpoint to fetch all computer objects from Active Directory using ldap3.
    This wraps the internal data-fetching function with a JSON response.
    """
    logger.info("Received request for /api/ad/get-computers.")
    result = _get_ad_computers_data()
    status_code = 401 if result.get("error_code") == 'AUTH_REQUIRED' else 500 if not result.get("ok") else 200
    return jsonify(result), status_code


@ad_bp.route('/api/ad/set-user-password', methods=['POST'])
def set_user_password():
    """
    Sets the password for a target user in Active Directory using ldap3.
    """
    data = request.get_json() or {}
    target_username = data.get('username')
    new_password = data.get('new_password')
    
    logger.info(f"Received request to set password for user '{target_username}'.")

    if not target_username or not new_password:
        logger.warning("Set user password request failed: Missing username or password.")
        return jsonify({'ok': False, 'error': 'Target username and new password are required.'}), 400

    conn, error, status = get_ldap_connection()
    if error:
        return jsonify(error), status
        
    try:
        base_dn = conn.server.info.other.get('defaultNamingContext')[0]
        search_filter = f"(&(objectCategory=person)(objectClass=user)(sAMAccountName={target_username}))"
        
        logger.info(f"Searching for user '{target_username}' to reset password.")
        conn.search(search_base=base_dn,
                    search_filter=search_filter,
                    attributes=['distinguishedName'])

        if not conn.entries:
            logger.warning(f"User '{target_username}' not found in AD for password reset.")
            return jsonify({'ok': False, 'error': f'User "{target_username}" not found in Active Directory.', 'error_code': 'USER_NOT_FOUND'}), 404

        user_dn = conn.entries[0].distinguishedName.value
        logger.info(f"Found user DN: {user_dn}. Attempting password modification.")

        quoted_password = f'"{new_password}"'
        password_value = quoted_password.encode('utf-16-le')

        success = conn.modify(user_dn, {'unicodePwd': [('MODIFY_REPLACE', [password_value])]})

        if success:
            logger.info(f'Successfully changed password for user "{target_username}".')
            return jsonify({'ok': True, 'message': f'Password for user "{target_username}" has been changed successfully.'})
        else:
            result_text = conn.result.get('description', '').lower()
            if 'constraint violation' in result_text or 'complexity' in result_text or 'history' in result_text:
                 logger.warning(f"Password change for '{target_username}' failed due to domain policy: {conn.result.get('message')}")
                 return jsonify({
                    'ok': False, 
                    'error': 'Failed to set password due to domain policy.',
                    'message': 'The new password likely does not meet the complexity, length, or history requirements of the domain.',
                    'error_code': 'AD_INVALID_PASSWORD_POLICY',
                    'details': conn.result.get('message', 'No details provided.')
                }), 400
            
            logger.error(f"Generic AD error on password change for '{target_username}': {conn.result.get('message')}")
            return jsonify({
                'ok': False, 
                'error': 'Active Directory Error', 
                'message': 'An Active Directory error occurred. This could be due to insufficient permissions to change the password for this user.',
                'error_code': 'AD_GENERIC_ERROR',
                'details': conn.result.get('message', 'No details provided.')
            }), 500

    except Exception as e:
        logger.error(f"Unexpected error while setting user password: {e}", exc_info=True)
        return jsonify({
            "ok": False, 
            "error": "Unexpected Error",
            "message": "An unexpected error occurred while setting the user password.",
            "error_code": "UNEXPECTED_ERROR",
            "details": str(e)
        }), 500
    finally:
        if conn:
            conn.unbind()
            logger.info("LDAP connection unbound after password operation.")

    
