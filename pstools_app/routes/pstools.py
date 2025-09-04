# دوال تشغيل أوامر PsTools (كل API خاصة بالأدوات)
import os
import re
import subprocess
from flask import Blueprint, request, jsonify, current_app, session
from pstools_app.utils.helpers import is_valid_ip, get_pstools_path, run_ps_command, parse_pslist_output, parse_psloggedon_output, parse_psfile_output, parse_psservice_output, parse_psloglist_output, parse_psinfo_output

def json_result(rc, out, err, structured_data=None):
    return jsonify({"rc": rc, "stdout": out, "stderr": err, "eula_required": False, "structured_data": structured_data})

pstools_bp = Blueprint('pstools', __name__)

@pstools_bp.before_request
def require_login():
    if request.endpoint and request.endpoint.startswith('pstools.'):
        if 'user' not in session or 'email' not in session:
            # For POST requests, return JSON error
            if request.method == 'POST':
                return jsonify({'rc': 401, 'stdout': '', 'stderr': 'Authentication required. Please log in.'}), 401
            # For GET requests or others, you might redirect or show a different error
            return "Authentication required", 401

@pstools_bp.route('/api/psexec', methods=['POST'])
def api_psexec():
    data = request.get_json() or {}
    ip, cmd = data.get("ip",""), data.get("cmd","")
    try:
        if not cmd:
            return json_result(2, "", "Command is required")
        # For commands with spaces, we need to handle them correctly
        cmd_args = ["cmd", "/c", cmd]
        # PsExec doesn't need auth args if the server is running with domain admin rights
        rc, out, err = run_ps_command("psexec", ip, None, None, cmd_args, timeout=180)
    except Exception as e:
        return json_result(2, "", str(e))
    return json_result(rc, out, err)


@pstools_bp.route('/api/psservice', methods=['POST'])
def api_psservice():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    svc, action = data.get("svc",""), data.get("action","query")
    if not svc and action != "query":
        return json_result(2, "", "Service name is required for start/stop/restart")
    try:
        if action == "restart":
            # First stop
            rc1, out1, err1 = run_ps_command("psservice", ip, email, pwd, ["stop", svc], timeout=60)
            # Then start, regardless of stop result
            rc, out, err = run_ps_command("psservice", ip, email, pwd, ["start", svc], timeout=60)
            out = f"--- STOP ATTEMPT ---\n{out1}\n\n--- START ATTEMPT ---\n{out}"
            err = f"--- STOP ATTEMPT ---\n{err1}\n\n--- START ATTEMPT ---\n{err}"
            structured_data = None # No structured data for actions
        elif action in ("start", "stop"):
             final_args = [action, svc]
             rc, out, err = run_ps_command("psservice", ip, email, pwd, final_args, timeout=60)
             structured_data = None
        elif action == "query":
            final_args = [action] + ([svc] if svc else [])
            rc, out, err = run_ps_command("psservice", ip, email, pwd, final_args, timeout=120)
            structured_data = None
            if rc == 0 and out:
                structured_data = parse_psservice_output(out)
        else:
            return json_result(2, "", "Invalid action")
    except Exception as e:
        return json_result(2, "", str(e))
    
    return json_result(rc, out, err, structured_data)


@pstools_bp.route('/api/pslist', methods=['POST'])
def api_pslist():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        rc, out, err = run_ps_command("pslist", ip, email, pwd, ["-x"], timeout=120)
    except Exception as e:
        return json_result(2, "", str(e))

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_pslist_output(out)
        
    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/api/pskill', methods=['POST'])
def api_pskill():
    data = request.get_json() or {}
    ip, email, pwd, proc = data.get("ip",""), session.get("email"), session.get("password"), data.get("proc","")
    if not proc:
        return json_result(2, "", "Process name or PID is required")
    try:
        rc, out, err = run_ps_command("pskill", ip, email, pwd, [proc], timeout=60)
    except Exception as e:
        return json_result(2, "", str(e))
    return json_result(rc, out, err)


@pstools_bp.route('/api/psloglist', methods=['POST'])
def api_psloglist():
    data = request.get_json() or {}
    ip, email, pwd, kind = data.get("ip",""), session.get("email"), session.get("password"), data.get("kind","system")
    try:
        rc, out, err = run_ps_command("psloglist", ip, email, pwd, ["-d", "1", kind], timeout=120)
    except Exception as e:
        return json_result(2, "", str(e))

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psloglist_output(out)

    return json_result(rc, out, err, structured_data)


@pstools_bp.route('/api/psinfo', methods=['POST'])
def api_psinfo():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        rc, out, err = run_ps_command("psinfo", ip, email, pwd, ["-d"], timeout=120)
    except Exception as e:
        return json_result(2, "", str(e))
    
    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psinfo_output(out)
        
    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/api/psloggedon', methods=['POST'])
def api_psloggedon():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        rc, out, err = run_ps_command("psloggedon", ip, email, pwd, [], timeout=60)
    except Exception as e:
        return json_result(2, "", str(e))

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psloggedon_output(out)

    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/api/psshutdown', methods=['POST'])
def api_psshutdown():
    data = request.get_json() or {}
    ip, email, pwd, action = data.get("ip",""), session.get("email"), session.get("password"), data.get("action","restart")
    flag = {"restart": "-r", "shutdown": "-s", "logoff": "-l"}.get(action)
    if not flag:
        return json_result(2, "", "Invalid power action")
    try:
        rc, out, err = run_ps_command("psshutdown", ip, email, pwd, [flag, "-t", "0", "-n"], timeout=60)
    except Exception as e:
        return json_result(2, "", str(e))
    return json_result(rc, out, err)

@pstools_bp.route('/api/psfile', methods=['POST'])
def api_psfile():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        rc, out, err = run_ps_command("psfile", ip, email, pwd, [], timeout=60)
    except Exception as e:
        return json_result(2, "", str(e))
    
    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psfile_output(out)

    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/api/psgetsid', methods=['POST'])
def api_psgetsid():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        rc, out, err = run_ps_command("psgetsid", ip, email, pwd, [], timeout=60)
    except Exception as e:
        return json_result(2, "", str(e))
    return json_result(rc, out, err)

@pstools_bp.route('/api/pspasswd', methods=['POST'])
def api_pspasswd():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    target_user, new_pass = data.get("targetUser",""), data.get("newpass","")
    if not target_user or not new_pass:
        return json_result(2, "", "Target user and new password are required")
    try:
        rc, out, err = run_ps_command("pspasswd", ip, email, pwd, [target_user, new_pass], timeout=60)
    except Exception as e:
        return json_result(2, "", str(e))
    return json_result(rc, out, err)

@pstools_bp.route('/api/pssuspend', methods=['POST'])
def api_pssuspend():
    data = request.get_json() or {}
    ip, email, pwd, proc = data.get("ip",""), session.get("email"), session.get("password"), data.get("proc","")
    if not proc:
        return json_result(2, "", "Process name or PID is required")
    try:
        rc, out, err = run_ps_command("pssuspend", ip, email, pwd, [proc], timeout=60)
    except Exception as e:
        return json_result(2, "", str(e))
    return json_result(rc, out, err)

@pstools_bp.route('/api/psping', methods=['POST'])
def api_psping():
    data = request.get_json() or {}
    ip, user, pwd, extra = data.get('ip',''), session.get('user'), session.get('password'), data.get('extra','')
    try:
        # PsPing does not use -u/-p, it relies on the context. But we can target an IP.
        # It's better to run it locally and target the remote IP.
        base_path = get_pstools_path("PsPing.exe")
        args = [base_path] 
        if extra:
            args += extra.split(' ')
        
        # The target IP should be the last argument if not specified with a flag
        if ip and not any(is_valid_ip(arg) for arg in args):
            args.append(ip)

        rc, out, err = run_ps_command("psping", ip=None, extra_args=args, timeout=120)

    except Exception as e:
        return json_result(2, "", str(e))
    return json_result(rc, out, err)
