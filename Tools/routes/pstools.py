# دوال تشغيل أوامر PsTools (كل API خاصة بالأدوات)
import os
import re
import subprocess
import json
from flask import Blueprint, request, jsonify, current_app, session
from Tools.utils.helpers import is_valid_ip, get_tools_path, run_ps_command, parse_pslist_output, parse_psloggedon_output, parse_psfile_output, parse_psservice_output, parse_psloglist_output, parse_psinfo_output
from Tools.utils.logger import logger

def json_result(rc, out, err, structured_data=None):
    # Ensure stdout is serializable, handle potential JSON in stdout for psbrowse
    final_stdout = out
    if isinstance(out, (dict, list)):
        try:
            final_stdout = json.dumps(out)
        except TypeError:
            final_stdout = str(out) # fallback to string representation
    
    return jsonify({
        "rc": rc, 
        "stdout": final_stdout, 
        "stderr": err, 
        "eula_required": False, 
        "structured_data": structured_data
    })

pstools_bp = Blueprint('pstools', __name__, url_prefix='/api/pstools')

@pstools_bp.before_request
def require_login():
    if 'user' not in session or 'email' not in session:
        logger.warning(f"Unauthorized access attempt to {request.endpoint}")
        if request.method == 'POST':
            return jsonify({'rc': 401, 'stdout': '', 'stderr': 'Authentication required. Please log in.'}), 401
        return "Authentication required", 401

@pstools_bp.route('/psexec', methods=['POST'])
def api_psexec():
    data = request.get_json() or {}
    ip, cmd = data.get("ip",""), data.get("cmd","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing psexec on {ip} with command: '{cmd}'")
    try:
        if not cmd:
            logger.warning(f"psexec request for {ip} failed: Command is required.")
            return json_result(2, "", "Command is required")
        cmd_args = ["cmd", "/c", cmd]
        rc, out, err = run_ps_command("psexec", ip, user, domain, pwd, cmd_args, timeout=180)
    except Exception as e:
        logger.error(f"psexec on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    return json_result(rc, out, err)


@pstools_bp.route('/psservice', methods=['POST'])
def api_psservice():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    svc, action = data.get("svc",""), data.get("action","query")
    logger.info(f"Executing psservice on {ip} with action: '{action}' for service: '{svc or 'all'}'")
    if not svc and action != "query":
        return json_result(2, "", "Service name is required for start/stop/restart")
    try:
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
    except Exception as e:
        logger.error(f"psservice on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    
    return json_result(rc, out, err, structured_data)


@pstools_bp.route('/pslist', methods=['POST'])
def api_pslist():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing pslist on {ip}.")
    try:
        rc, out, err = run_ps_command("pslist", ip, user, domain, pwd, ["-x"], timeout=120)
    except Exception as e:
        logger.error(f"pslist on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_pslist_output(out)
        
    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/pskill', methods=['POST'])
def api_pskill():
    data = request.get_json() or {}
    ip, proc = data.get("ip",""), data.get("proc","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing pskill on {ip} for process: '{proc}'.")
    if not proc:
        return json_result(2, "", "Process name or PID is required")
    try:
        rc, out, err = run_ps_command("pskill", ip, user, domain, pwd, [proc], timeout=60)
    except Exception as e:
        logger.error(f"pskill on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    return json_result(rc, out, err)


@pstools_bp.route('/psloglist', methods=['POST'])
def api_psloglist():
    data = request.get_json() or {}
    ip, kind = data.get("ip",""), data.get("kind","system")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing psloglist on {ip} for log type: '{kind}'.")
    try:
        rc, out, err = run_ps_command("psloglist", ip, user, domain, pwd, ["-d", "1", kind], timeout=120)
    except Exception as e:
        logger.error(f"psloglist on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psloglist_output(out)

    return json_result(rc, out, err, structured_data)


@pstools_bp.route('/psinfo', methods=['POST'])
def api_psinfo():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing psinfo on {ip}.")
    try:
        rc, out, err = run_ps_command("psinfo", ip, user, domain, pwd, ["-d"], timeout=120)
    except Exception as e:
        logger.error(f"psinfo on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    
    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psinfo_output(out)
        
    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/psloggedon', methods=['POST'])
def api_psloggedon():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing psloggedon on {ip}.")
    try:
        rc, out, err = run_ps_command("psloggedon", ip, user, domain, pwd, [], timeout=60)
    except Exception as e:
        logger.error(f"psloggedon on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psloggedon_output(out)

    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/psshutdown', methods=['POST'])
def api_psshutdown():
    data = request.get_json() or {}
    ip, action = data.get("ip",""), data.get("action","restart")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    flag = {"restart": "-r", "shutdown": "-s", "logoff": "-l"}.get(action)
    logger.info(f"Executing psshutdown on {ip} with action: '{action}'.")
    if not flag:
        return json_result(2, "", "Invalid power action")
    
    args = [flag, "-t", "0"]
    if action in ["restart", "shutdown"]:
        args.append("-f")

    try:
        rc, out, err = run_ps_command("psshutdown", ip, user, domain, pwd, args, timeout=60)
    except Exception as e:
        logger.error(f"psshutdown on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    return json_result(rc, out, err)

@pstools_bp.route('/psfile', methods=['POST'])
def api_psfile():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing psfile on {ip}.")
    try:
        rc, out, err = run_ps_command("psfile", ip, user, domain, pwd, [], timeout=60)
    except Exception as e:
        logger.error(f"psfile on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    
    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psfile_output(out)

    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/psgetsid', methods=['POST'])
def api_psgetsid():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing psgetsid on {ip}.")
    try:
        rc, out, err = run_ps_command("psgetsid", ip, user, domain, pwd, [], timeout=60)
    except Exception as e:
        logger.error(f"psgetsid on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    return json_result(rc, out, err)

@pstools_bp.route('/pspasswd', methods=['POST'])
def api_pspasswd():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    target_user, new_pass = data.get("targetUser",""), data.get("newpass","")
    logger.info(f"Executing pspasswd on {ip} for user '{target_user}'.")
    if not target_user or not new_pass:
        return json_result(2, "", "Target user and new password are required")
    try:
        rc, out, err = run_ps_command("pspasswd", ip, user, domain, pwd, [target_user, new_pass], timeout=60)
    except Exception as e:
        logger.error(f"pspasswd on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    return json_result(rc, out, err)

@pstools_bp.route('/pssuspend', methods=['POST'])
def api_pssuspend():
    data = request.get_json() or {}
    ip, proc = data.get("ip",""), data.get("proc","")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing pssuspend on {ip} for process: '{proc}'.")
    if not proc:
        return json_result(2, "", "Process name or PID is required")
    try:
        rc, out, err = run_ps_command("pssuspend", ip, user, domain, pwd, [proc], timeout=60)
    except Exception as e:
        logger.error(f"pssuspend on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    return json_result(rc, out, err)

@pstools_bp.route('/psping', methods=['POST'])
def api_psping():
    data = request.get_json() or {}
    ip, extra = data.get('ip',''), data.get('extra','')
    logger.info(f"Executing psping on {ip} with extra args: '{extra}'.")
    try:
        base_path = get_tools_path("PsPing.exe")
        args = [base_path] 
        if extra:
            args += extra.split(' ')
        
        if ip and not any(is_valid_ip(arg) for arg in args):
            args.append(ip)

        rc, out, err = run_ps_command("psping", ip=None, extra_args=args, timeout=120)

    except Exception as e:
        logger.error(f"psping on {ip} failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")
    return json_result(rc, out, err)

@pstools_bp.route('/psbrowse', methods=['POST'])
def api_psbrowse():
    data = request.get_json() or {}
    ip = data.get("ip", "")
    path = data.get("path", "C:\\")
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    logger.info(f"Executing file browse on {ip} for path: '{path}'")

    try:
        # Basic sanitation: remove quotes and disallow traversal beyond a root drive
        clean_path = path.replace("'", "").replace('"', '')
        if ".." in clean_path:
            logger.warning(f"Path traversal attempt blocked for path: '{path}'")
            return json_result(1, "", "Path traversal is not allowed.")
        if not re.match(r"^[a-zA-Z]:\\", clean_path):
             logger.warning(f"Invalid root path specified: '{path}'")
             # Fallback to C: drive if path is suspicious
             clean_path = "C:\\"


        # Construct the PowerShell command.
        # Force is used to get hidden/system items. ErrorAction SilentlyContinue ignores permission errors on individual files.
        ps_command = f"Get-ChildItem -Path '{clean_path}' -Force -ErrorAction SilentlyContinue | Select-Object Name, FullName, Length, LastWriteTime, Mode | ConvertTo-Json -Compress"
        
        # Use powershell.exe directly as the command for psexec. This is more reliable for capturing output.
        cmd_args = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_command]

        rc, out, err = run_ps_command("psexec", ip, user, domain, pwd, cmd_args, timeout=180, suppress_errors=True)
        
        structured_data = None
        if rc == 0 and out.strip():
            try:
                # The output from ConvertTo-Json might be a single object or an array of objects
                # It might also be prefixed with unwanted text from psexec banner
                # We find the first occurrence of '{' or '[' to locate the start of JSON.
                json_start_index = -1
                first_bracket = out.find('[')
                first_curly = out.find('{')

                if first_bracket != -1 and (first_curly == -1 or first_bracket < first_curly):
                    json_start_index = first_bracket
                elif first_curly != -1:
                    json_start_index = first_curly

                if json_start_index != -1:
                    json_str = out[json_start_index:]
                    parsed_json = json.loads(json_str)
                    
                    # Ensure the result is always an array
                    if not isinstance(parsed_json, list):
                        parsed_json = [parsed_json]
                    structured_data = {"psbrowse": parsed_json}
                else:
                    # If we can't find valid json, treat it as an error condition for the UI
                    # But it could also just be an empty directory, which is not an error.
                    # The command successfully ran (rc==0), so we return an empty list.
                    logger.warning(f"psbrowse for path '{clean_path}' returned empty. Output: {out}")
                    structured_data = {"psbrowse": []}
                    if not err:
                        err = f"Could not find valid JSON in output. The directory '{clean_path}' may be empty or inaccessible."

            except json.JSONDecodeError:
                logger.error(f"Failed to parse JSON from psbrowse output. Output was: {out}")
                err = f"Failed to parse command output as JSON. {err}"
                rc = 1 # Mark as failed if JSON parsing fails
        
        elif rc != 0:
             logger.error(f"psbrowse command failed for path '{clean_path}'. RC={rc}. Stderr: {err}")
        
        # If the command ran but produced no stdout and no error, it's likely an empty dir.
        elif rc == 0 and not out.strip():
            structured_data = {"psbrowse": []}

    except Exception as e:
        logger.error(f"psbrowse on {ip} for path '{path}' failed with exception: {e}", exc_info=True)
        return json_result(1, "", f"An unexpected exception occurred: {str(e)}")

    # Special handling to return raw output in 'out' for frontend and parsed data in 'structured_data'
    return json_result(rc, out, err, structured_data)

    

    