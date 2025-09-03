# دوال تشغيل أوامر PsTools (كل API خاصة بالأدوات)
import os
import subprocess
from flask import Blueprint, request, jsonify, current_app, session
from pstools_app.utils.helpers import is_valid_ip

PSTOOLS_DIR = os.environ.get("PSTOOLS_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "Sysinternals"))

def pspath(exe_name: str) -> str:
    candidate = os.path.join(PSTOOLS_DIR, exe_name)
    return candidate if os.path.isfile(candidate) else exe_name

def run_cmd(cmd_list, timeout=90):
    # Add -accepteula to all pstools commands
    if cmd_list and os.path.basename(cmd_list[0]).lower().startswith("ps") and "-accepteula" not in cmd_list:
        cmd_list.insert(1, "-accepteula")
    try:
        completed = subprocess.run(
            cmd_list,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,  # نحتاج raw bytes لمعالجة الترميز
            timeout=timeout,
            shell=False,
            creationflags=subprocess.CREATE_NO_WINDOW # منع ظهور نافذة CMD
        )
        def decode_output(raw):
            if not raw:
                return ""
            if raw.startswith(b'\xff\xfe'):
                try:
                    return raw.decode('utf-16le')
                except Exception:
                    pass
            try:
                return raw.decode('utf-8')
            except Exception:
                try:
                    return raw.decode('cp1252')
                except Exception:
                    return raw.decode(errors='replace')
        out = decode_output(completed.stdout)
        err = decode_output(completed.stderr)
        return completed.returncode, out, err
    except subprocess.TimeoutExpired as e:
        return 124, "", f"Command timed out after {timeout}s"
    except FileNotFoundError as e:
        return 127, "", f"Executable not found: {e}"
    except Exception as e:
        return 1, "", f"Unexpected error: {e}"

def build_remote_args(ip, user, pwd):
    args = []
    if ip:
        if not is_valid_ip(ip):
            raise ValueError("Invalid IP address")
        args.append(f"\\\\{ip}")
    
    # We must have user and pass for remote execution
    if user:
        args += ["-u", user]
    if pwd:
        args += ["-p", pwd]
    else: # If password is not provided, send an empty string for pstool
        args += ["-p", ""]

    return args

def json_result(rc, out, err):
    return jsonify({"rc": rc, "stdout": out, "stderr": err, "eula_required": False})

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
    ip, user, pwd, cmd = data.get("ip",""), session.get("user"), session.get("password"), data.get("cmd","")
    try:
        args = [pspath("PsExec.exe")] + build_remote_args(ip, user, pwd)
        if not cmd:
            return json_result(2, "", "Command is required")
        # For commands with spaces, we need to handle them correctly
        args += ["cmd", "/c", cmd]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=180)
    return json_result(rc, out, err)

@pstools_bp.route('/api/psservice', methods=['POST'])
def api_psservice():
    data = request.get_json() or {}
    ip, user, pwd = data.get("ip",""), session.get("user"), session.get("password")
    svc, action = data.get("svc",""), data.get("action","query")
    if not svc and action != "query":
        return json_result(2, "", "Service name is required for start/stop/restart")
    try:
        args = [pspath("PsService.exe")] + build_remote_args(ip, user, pwd)
        if action == "restart":
            # First stop
            args_stop = args + ["stop", svc]
            rc1, out1, err1 = run_cmd(args_stop, timeout=60)
            if rc1 != 0:
                # If stopping fails, maybe it's already stopped. Try starting.
                pass
            # Then start
            args_start = args + ["start", svc]
            rc, out, err = run_cmd(args_start, timeout=60)
            # Combine outputs for clarity
            out = f"--- STOP ATTEMPT ---\n{out1}\n\n--- START ATTEMPT ---\n{out}"
            err = f"--- STOP ATTEMPT ---\n{err1}\n\n--- START ATTEMPT ---\n{err}"

        elif action in ("query", "start", "stop"):
            args += [action] + ([svc] if svc else [])
            rc, out, err = run_cmd(args, timeout=120)
        else:
            return json_result(2, "", "Invalid action")
    except Exception as e:
        return json_result(2, "", str(e))
    
    return json_result(rc, out, err)

@pstools_bp.route('/api/pslist', methods=['POST'])
def api_pslist():
    data = request.get_json() or {}
    ip, user, pwd = data.get("ip",""), session.get("user"), session.get("password")
    try:
        args = [pspath("PsList.exe")] + build_remote_args(ip, user, pwd) + ["-x"]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=120)
    return json_result(rc, out, err)

@pstools_bp.route('/api/pskill', methods=['POST'])
def api_pskill():
    data = request.get_json() or {}
    ip, user, pwd, proc = data.get("ip",""), session.get("user"), session.get("password"), data.get("proc","")
    if not proc:
        return json_result(2, "", "Process name or PID is required")
    try:
        args = [pspath("PsKill.exe")] + build_remote_args(ip, user, pwd) + [proc]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/api/psloglist', methods=['POST'])
def api_psloglist():
    data = request.get_json() or {}
    ip, user, pwd, kind = data.get("ip",""), session.get("user"), session.get("password"), data.get("kind","system")
    try:
        args = [pspath("PsLogList.exe")] + build_remote_args(ip, user, pwd) + ["-d", "1", kind] # last day
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=120)
    return json_result(rc, out, err)

@pstools_bp.route('/api/psinfo', methods=['POST'])
def api_psinfo():
    data = request.get_json() or {}
    ip, user, pwd = data.get("ip",""), session.get("user"), session.get("password")
    try:
        args = [pspath("PsInfo.exe")] + build_remote_args(ip, user, pwd) + ["-d"] # Show disk info
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=120)
    return json_result(rc, out, err)

@pstools_bp.route('/api/psloggedon', methods=['POST'])
def api_psloggedon():
    data = request.get_json() or {}
    ip, user, pwd = data.get("ip",""), session.get("user"), session.get("password")
    try:
        args = [pspath("PsLoggedOn.exe")] + build_remote_args(ip, user, pwd)
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/api/psshutdown', methods=['POST'])
def api_psshutdown():
    data = request.get_json() or {}
    ip, user, pwd, action = data.get("ip",""), session.get("user"), session.get("password"), data.get("action","restart")
    flag = {"restart": "-r", "shutdown": "-s", "logoff": "-l"}.get(action)
    if not flag:
        return json_result(2, "", "Invalid power action")
    try:
        args = [pspath("PsShutdown.exe")] + build_remote_args(ip, user, pwd) + [flag, "-t", "0", "-n"]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/api/psfile', methods=['POST'])
def api_psfile():
    data = request.get_json() or {}
    ip, user, pwd = data.get("ip",""), session.get("user"), session.get("password")
    try:
        args = [pspath("PsFile.exe")] + build_remote_args(ip, user, pwd)
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/api/psgetsid', methods=['POST'])
def api_psgetsid():
    data = request.get_json() or {}
    ip, user, pwd = data.get("ip",""), session.get("user"), session.get("password")
    try:
        args = [pspath("PsGetSid.exe")] + build_remote_args(ip, user, pwd)
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/api/pspasswd', methods=['POST'])
def api_pspasswd():
    data = request.get_json() or {}
    ip, user, pwd = data.get("ip",""), session.get("user"), session.get("password")
    target_user, new_pass = data.get("targetUser",""), data.get("newpass","")
    if not target_user or not new_pass:
        return json_result(2, "", "Target user and new password are required")
    try:
        args = [pspath("PsPasswd.exe")] + build_remote_args(ip, user, pwd) + [target_user, new_pass]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/api/pssuspend', methods=['POST'])
def api_pssuspend():
    data = request.get_json() or {}
    ip, user, pwd, proc = data.get("ip",""), session.get("user"), session.get("password"), data.get("proc","")
    if not proc:
        return json_result(2, "", "Process name or PID is required")
    try:
        args = [pspath("PsSuspend.exe")] + build_remote_args(ip, user, pwd) + [proc]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/api/psping', methods=['POST'])
def api_psping():
    data = request.get_json() or {}
    ip, user, pwd, extra = data.get('ip',''), session.get('user'), session.get('password'), data.get('extra','')
    try:
        # PsPing does not use -u/-p, it relies on the context. But we can target an IP.
        # It's better to run it locally and target the remote IP.
        args = [pspath("PsPing.exe")] 
        if extra:
            args += extra.split(' ')
        
        # The target IP should be the last argument if not specified with a flag
        if not any(is_valid_ip(arg) for arg in args):
            args.append(ip)

    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=120)
    return json_result(rc, out, err)
