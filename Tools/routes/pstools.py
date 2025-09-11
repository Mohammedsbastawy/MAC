# دوال تشغيل أوامر PsTools (كل API خاصة بالأدوات)
import os
import re
import subprocess
import json
from flask import Blueprint, request, jsonify, current_app, session
from Tools.utils.helpers import is_valid_ip, get_tools_path, run_ps_command, parse_pslist_output, parse_psloggedon_output, parse_psfile_output, parse_psservice_output, parse_psloglist_output, parse_psinfo_output, run_winrm_command
from Tools.utils.logger import logger

def json_result(rc, out, err, structured_data=None):
    # Ensure stdout is serializable, handle potential JSON in stdout for psbrowse
    final_stdout = out
    if isinstance(out, (dict, list)):
        try:
            final_stdout = json.dumps(out)
        except TypeError:
            final_stdout = str(out) # fallback to string representation
    
    # Improved error structure
    ok = rc == 0
    error_message = err if not ok else ""
    
    response = {
        "ok": ok,
        "rc": rc, 
        "stdout": final_stdout, 
        "stderr": err, # Keep original stderr for raw output
        "error": error_message, # Main error message for UI
        "eula_required": False, 
        "structured_data": structured_data
    }
    
    # Return 200 even on command failure, so the frontend can parse the JSON error
    return jsonify(response), 200


pstools_bp = Blueprint('pstools', __name__, url_prefix='/api/pstools')

def get_auth_from_request(data):
    """Safely gets auth credentials from request JSON or falls back to session."""
    user = data.get("username") or session.get("user")
    domain = data.get("domain") or session.get("domain")
    pwd = data.get("pwd") or session.get("password")
    
    # For WinRM, we need user@domain format.
    # If a UPN is provided (e.g. from session), use it. Otherwise construct it.
    if '@' in user:
        winrm_user = user
    else:
        winrm_user = f"{user}@{domain}"
        
    return user, domain, pwd, winrm_user

@pstools_bp.before_request
def require_login():
    # We will check for auth within each route instead, as some requests
    # might carry their own credentials in the body.
    # This is a placeholder for now.
    pass


@pstools_bp.route('/psexec', methods=['POST'])
def api_psexec():
    data = request.get_json() or {}
    ip, cmd = data.get("ip",""), data.get("cmd","")
    user, domain, pwd, _ = get_auth_from_request(data)
    
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    
    logger.info(f"Executing psexec on {ip} with command: '{cmd}'")
    if not cmd:
        logger.warning(f"psexec request for {ip} failed: Command is required.")
        return json_result(2, "", "Command is required")
    cmd_args = ["cmd", "/c", cmd]
    rc, out, err = run_ps_command("psexec", ip, user, domain, pwd, cmd_args, timeout=180)
    return json_result(rc, out, err)


@pstools_bp.route('/psservice', methods=['POST'])
def api_psservice():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd, _ = get_auth_from_request(data)
    svc, action = data.get("svc",""), data.get("action","query")

    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401

    logger.info(f"Executing psservice on {ip} with action: '{action}' for service: '{svc or 'all'}'")
    if not svc and action != "query":
        return json_result(2, "", "Service name is required for start/stop/restart")
    
    if action == "restart":
        logger.info(f"Attempting to restart service '{svc}' on {ip}.")
        rc1, out1, err1 = run_ps_command("psservice", ip, user, domain, pwd, ["stop", svc], timeout=60)
        rc, out, err = run_ps_command("psservice", ip, user, domain, pwd, ["start", svc], timeout=60)
        out = f"--- STOP ATTEMPT ---\n{out1}\n\n--- START ATTEMPT ---\n{out}"
        err = f"--- STOP ATTEMPT ---\n{err1}\n\n--- START ATTEMPT ---\n{err}"
        structured_data = None
    elif action in ("start", "stop"):
            final_args = [action, svc]
            rc, out, err = run_ps_command("psservice", ip, user, domain, pwd, final_args, timeout=60)
            structured_data = None
    elif action == "query":
        final_args = [action] + ([svc] if svc else [])
        rc, out, err = run_ps_command("psservice", ip, user, domain, pwd, final_args, timeout=120)
        structured_data = None
        if rc == 0 and out:
            structured_data = parse_psservice_output(out)
    else:
        return json_result(2, "", "Invalid action")
    
    return json_result(rc, out, err, structured_data)


@pstools_bp.route('/pslist', methods=['POST'])
def api_pslist():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd, _ = get_auth_from_request(data)
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    logger.info(f"Executing pslist on {ip}.")
    rc, out, err = run_ps_command("pslist", ip, user, domain, pwd, ["-x"], timeout=120)

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_pslist_output(out)
        
    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/pskill', methods=['POST'])
def api_pskill():
    data = request.get_json() or {}
    ip, proc = data.get("ip",""), data.get("proc","")
    user, domain, pwd, _ = get_auth_from_request(data)
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    logger.info(f"Executing pskill on {ip} for process: '{proc}'.")
    if not proc:
        return json_result(2, "", "Process name or PID is required")
    rc, out, err = run_ps_command("pskill", ip, user, domain, pwd, [proc], timeout=60)
    return json_result(rc, out, err)


@pstools_bp.route('/psloglist', methods=['POST'])
def api_psloglist():
    data = request.get_json() or {}
    ip, kind = data.get("ip",""), data.get("kind","system")
    user, domain, pwd, _ = get_auth_from_request(data)
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    logger.info(f"Executing psloglist on {ip} for log type: '{kind}'.")
    rc, out, err = run_ps_command("psloglist", ip, user, domain, pwd, ["-d", "1", kind], timeout=120)

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psloglist_output(out)

    return json_result(rc, out, err, structured_data)


@pstools_bp.route('/psinfo', methods=['POST'])
def api_psinfo():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd, _ = get_auth_from_request(data)
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    logger.info(f"Executing psinfo on {ip}.")
    rc, out, err = run_ps_command("psinfo", ip, user, domain, pwd, ["-d"], timeout=120)
    
    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psinfo_output(out)
        
    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/psloggedon', methods=['POST'])
def api_psloggedon():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd, _ = get_auth_from_request(data)
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    logger.info(f"Executing psloggedon on {ip}.")
    rc, out, err = run_ps_command("psloggedon", ip, user, domain, pwd, [], timeout=60)

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psloggedon_output(out)

    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/psshutdown', methods=['POST'])
def api_psshutdown():
    data = request.get_json() or {}
    ip, action = data.get("ip",""), data.get("action","restart")
    user, domain, pwd, _ = get_auth_from_request(data)
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    flag = {"restart": "-r", "shutdown": "-s", "logoff": "-l"}.get(action)
    logger.info(f"Executing psshutdown on {ip} with action: '{action}'.")
    if not flag:
        return json_result(2, "", "Invalid power action")
    
    args = [flag, "-t", "0"]
    if action in ["restart", "shutdown"]:
        args.append("-f")

    rc, out, err = run_ps_command("psshutdown", ip, user, domain, pwd, args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/psfile', methods=['POST'])
def api_psfile():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd, _ = get_auth_from_request(data)
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    logger.info(f"Executing psfile on {ip}.")
    rc, out, err = run_ps_command("psfile", ip, user, domain, pwd, [], timeout=60)
    
    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psfile_output(out)

    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/psgetsid', methods=['POST'])
def api_psgetsid():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd, _ = get_auth_from_request(data)
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    logger.info(f"Executing psgetsid on {ip}.")
    rc, out, err = run_ps_command("psgetsid", ip, user, domain, pwd, [], timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/pspasswd', methods=['POST'])
def api_pspasswd():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd, _ = get_auth_from_request(data)
    target_user, new_pass = data.get("targetUser",""), data.get("newpass","")
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    logger.info(f"Executing pspasswd on {ip} for user '{target_user}'.")
    if not target_user or not new_pass:
        return json_result(2, "", "Target user and new password are required")
    rc, out, err = run_ps_command("pspasswd", ip, user, domain, pwd, [target_user, new_pass], timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/pssuspend', methods=['POST'])
def api_pssuspend():
    data = request.get_json() or {}
    ip, proc = data.get("ip",""), data.get("proc","")
    user, domain, pwd, _ = get_auth_from_request(data)
    if not all([user, domain, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401
    logger.info(f"Executing pssuspend on {ip} for process: '{proc}'.")
    if not proc:
        return json_result(2, "", "Process name or PID is required")
    rc, out, err = run_ps_command("pssuspend", ip, user, domain, pwd, [proc], timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/psping', methods=['POST'])
def api_psping():
    data = request.get_json() or {}
    ip, extra = data.get('ip',''), data.get('extra','')
    logger.info(f"Executing psping on {ip} with extra args: '{extra}'.")
    
    base_path = get_tools_path("PsPing.exe")
    args = [base_path] 
    if extra:
        args += extra.split(' ')
    
    if ip and not any(is_valid_ip(arg) for arg in args):
        args.append(ip)

    rc, out, err = run_ps_command("psping", ip=None, extra_args=args, timeout=120)

    return json_result(rc, out, err)

@pstools_bp.route('/psbrowse', methods=['POST'])
def api_psbrowse():
    data = request.get_json() or {}
    ip = data.get("ip", "")
    path = data.get("path", "") # An empty path will signal to get drives
    _, _, pwd, winrm_user = get_auth_from_request(data)

    if not all([ip, winrm_user, pwd]):
         return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401

    logger.info(f"Executing file browse (WinRM) on {ip} for path: '{path or 'drives'}'")
    
    if path and path != "drives": # Browsing a directory
        # Basic sanitation: remove quotes and disallow traversal beyond a root drive
        clean_path = path.replace("'", "").replace('"', '')
        if ".." in clean_path:
            logger.warning(f"Path traversal attempt blocked for path: '{path}'")
            return json_result(1, "", "Path traversal is not allowed.")
        if not re.match(r"^[a-zA-Z]:\\", clean_path) and not re.match(r"^[a-zA-Z]:\\.*", clean_path):
            logger.warning(f"Invalid path specified: '{path}'")
            return json_result(1, "", "Invalid path format.")
        
        ps_command = f"""
        Get-ChildItem -Path '{clean_path}' -Force -ErrorAction SilentlyContinue | 
        Select-Object Name, FullName, Length, @{{Name='LastWriteTime';Expression={{$_.LastWriteTime.ToUniversalTime().ToString('o')}}}}, @{{Name='Mode';Expression={{$_.Mode.ToString()}}}} | 
        ConvertTo-Json -Compress
        """
    else: # Getting drives
        ps_command = """
        Get-PSDrive -PSProvider FileSystem | ForEach-Object {
            [PSCustomObject]@{
                Name          = $_.Name;
                FullName      = $_.Root;
                Length        = $null;
                LastWriteTime = (Get-Date 0).ToUniversalTime().ToString('o');
                Mode          = 'd-----';
            }
        } | ConvertTo-Json -Compress
        """
    
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command)
    
    structured_data = None
    if rc == 0:
        if out.strip():
            try:
                # The output from WinRM is usually clean JSON
                parsed_json = json.loads(out)
                
                # Ensure it's always a list for consistency
                if not isinstance(parsed_json, list):
                    parsed_json = [parsed_json]
                structured_data = {"psbrowse": parsed_json}

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from WinRM output. Error: {e}. Output was: {out}")
                err = f"Failed to parse command output as JSON. Raw output might contain an error. {err}"
                rc = 1 # Mark as failed if JSON parsing fails
        else: # Command succeeded but output was empty (e.g. empty folder)
            structured_data = {"psbrowse": []}
    
    elif rc != 0:
        logger.error(f"WinRM command failed for path '{path}'. RC={rc}. Stderr: {err}")
    
    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/enable-winrm', methods=['POST'])
def api_enable_winrm():
    """
    Remotely enables WinRM on a target machine using PsExec.
    This is a powerful command that configures the service and firewall.
    """
    data = request.get_json() or {}
    ip = data.get("ip")
    if not ip:
        return jsonify({"ok": False, "error": "IP address is required."}), 400

    user, domain, pwd, _ = get_auth_from_request(data)

    if not all([user, domain, pwd]):
        return jsonify({'ok': False, 'rc': 401, 'error': 'Authentication required. Please log in.'}), 401

    logger.info(f"Attempting to enable WinRM on {ip} using PsExec.")

    # The command to silently enable WinRM and configure the firewall.
    # We use powershell.exe -Command to ensure it runs correctly.
    winrm_command = 'powershell.exe -Command "winrm quickconfig -q -force"'

    # We need to pass this command to psexec.
    # The arguments for run_ps_command are tool_name, ip, user, domain, pwd, and extra_args.
    # extra_args should be the command to execute.
    rc, out, err = run_ps_command("psexec", ip, user, domain, pwd, [winrm_command], timeout=120)

    if rc == 0:
        logger.info(f"Successfully sent WinRM enable command to {ip}. Output: {out}")
        return jsonify({
            "ok": True,
            "message": "WinRM enable command sent successfully. It may take a moment to apply."
        })
    else:
        logger.error(f"Failed to enable WinRM on {ip}. RC: {rc}, Error: {err}")
        return jsonify({
            "ok": False,
            "error": "Failed to enable WinRM.",
            "details": err or out
        }), 500
    

    




    


