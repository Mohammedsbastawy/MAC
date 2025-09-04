# دوال تشغيل أوامر PsTools (كل API خاصة بالأدوات)
import os
import re
import subprocess
from flask import Blueprint, request, jsonify, current_app, session
from pstools_app.utils.helpers import is_valid_ip, get_pstools_path

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

def build_remote_args(user_email, pwd):
    args = []
    if user_email:
        # Use the full email for domain authentication, which works for user@domain.com format
        args += ["-u", user_email]
    if pwd:
        args += ["-p", pwd]
    else: # If password is not provided, send an empty string for pstool
        args += ["-p", ""]
    return args

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

def build_target_arg(ip):
    if not ip or not is_valid_ip(ip):
        raise ValueError("Invalid or missing IP address for target.")
    return f"\\\\{ip}"

@pstools_bp.route('/api/psexec', methods=['POST'])
def api_psexec():
    data = request.get_json() or {}
    ip, email, pwd, cmd = data.get("ip",""), session.get("email"), session.get("password"), data.get("cmd","")
    try:
        if not cmd:
            return json_result(2, "", "Command is required")
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        # For commands with spaces, we need to handle them correctly
        cmd_args = ["cmd", "/c", cmd]
        args = [get_pstools_path("PsExec.exe"), target_arg] + cred_args + cmd_args
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=180)
    return json_result(rc, out, err)

def parse_psservice_output(output):
    data = []
    # Split by the service name delimiter, keeping the delimiter
    service_blocks = re.split(r'(?=\nSERVICE_NAME:)', output.strip())
    
    for block in service_blocks:
        if not block.strip() or "PsService" in block or "Copyright" in block:
            continue
        
        service_data = {}
        # Use regex to find key-value pairs
        name_match = re.search(r'SERVICE_NAME:\s*(.+)', block)
        display_name_match = re.search(r'DISPLAY_NAME:\s*(.+)', block)
        state_match = re.search(r'STATE\s+:\s*\d+\s+([A-Z_]+)', block)
        type_match = re.search(r'TYPE\s+:\s*[\w\s]+\s+([A-Z_]+(?: [A-Z_]+)*)', block)
        
        # Extract description which can be multi-line. It comes after DISPLAY_NAME.
        # It ends before the next structured line like TYPE or STATE.
        description_match = re.search(r'DISPLAY_NAME:\s*.+?\n((?:.|\n)*?)\n\s*(?:GROUP|TYPE|STATE)', block, re.DOTALL)

        if name_match: service_data['name'] = name_match.group(1).strip()
        if display_name_match: service_data['display_name'] = display_name_match.group(1).strip()
        if state_match: service_data['state'] = state_match.group(1).strip()
        if type_match: service_data['type'] = type_match.group(1).strip()
        
        if description_match:
            # Clean up the description
            description = description_match.group(1).strip()
            # The description itself is often the lines after display name, before the next key-value pair
            desc_lines = []
            for line in description.split('\n'):
                # Stop if we hit another key like TYPE, STATE, etc.
                if re.match(r'^\s*(?:TYPE|STATE|GROUP|WIN32_EXIT_CODE)\s*:', line):
                    break
                desc_lines.append(line.strip())
            service_data['description'] = ' '.join(desc_lines).strip()
        else:
            service_data['description'] = "No description available."

        if all(k in service_data for k in ['name', 'display_name', 'state', 'type']):
            data.append(service_data)
            
    return {"psservice": data} if data else None

@pstools_bp.route('/api/psservice', methods=['POST'])
def api_psservice():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    svc, action = data.get("svc",""), data.get("action","query")
    if not svc and action != "query":
        return json_result(2, "", "Service name is required for start/stop/restart")
    try:
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        base_args = [get_pstools_path("PsService.exe"), target_arg] + cred_args

        if action == "restart":
            # First stop
            args_stop = base_args + ["stop", svc]
            rc1, out1, err1 = run_cmd(args_stop, timeout=60)
            # Then start, regardless of stop result
            args_start = base_args + ["start", svc]
            rc, out, err = run_cmd(args_start, timeout=60)
            out = f"--- STOP ATTEMPT ---\n{out1}\n\n--- START ATTEMPT ---\n{out}"
            err = f"--- STOP ATTEMPT ---\n{err1}\n\n--- START ATTEMPT ---\n{err}"
            structured_data = None # No structured data for actions
        elif action in ("start", "stop"):
             final_args = base_args + [action, svc]
             rc, out, err = run_cmd(final_args, timeout=60)
             structured_data = None
        elif action == "query":
            final_args = base_args + [action] + ([svc] if svc else [])
            rc, out, err = run_cmd(final_args, timeout=120)
            structured_data = None
            if rc == 0 and out:
                structured_data = parse_psservice_output(out)
        else:
            return json_result(2, "", "Invalid action")
    except Exception as e:
        return json_result(2, "", str(e))
    
    return json_result(rc, out, err, structured_data)

def parse_pslist_output(output):
    data = []
    lines = output.strip().split('\n')
    header_found = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Find the header line to start parsing
        if re.match(r'Name\s+Pid', line):
            header_found = True
            continue
            
        if '----' in line:
            continue

        if header_found:
            # Split by 2 or more spaces to handle variable spacing
            parts = re.split(r'\s{2,}', line)
            if len(parts) >= 8:
                data.append({
                    "name": parts[0],
                    "pid": parts[1],
                    "pri": parts[2],
                    "thd": parts[3],
                    "hnd": parts[4],
                    "priv": parts[5],
                    "cpu_time": parts[6],
                    "elapsed_time": parts[7]
                })

    return {"pslist": data} if data else None


@pstools_bp.route('/api/pslist', methods=['POST'])
def api_pslist():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        args = [get_pstools_path("PsList.exe"), target_arg] + cred_args + ["-x"]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=120)

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
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        args = [get_pstools_path("PsKill.exe"), target_arg] + cred_args + [proc]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

def parse_psloglist_output(output):
    events = []
    # Split the entire output into blocks, where each block starts with the record number in brackets.
    event_blocks = re.split(r'(?=\[\d+\])', output)
    
    for block in event_blocks:
        block = block.strip()
        if not block or "PsLoglist" in block or "System log on" in block:
            continue
        
        event_data = {}
        # Using regex to capture all fields
        record_match = re.search(r'\[(\d+)\]\s*(.*)', block)
        type_match = re.search(r'Type:\s+(.*)', block)
        computer_match = re.search(r'Computer:\s+(.*)', block)
        time_match = re.search(r'Time:\s+(.*)', block)
        id_match = re.search(r'ID:\s+(.*)', block)
        user_match = re.search(r'User:\s+(.*)', block)
        
        if record_match:
            event_data['record_num'] = record_match.group(1).strip()
            event_data['source'] = record_match.group(2).strip()
        
        if type_match: event_data['type'] = type_match.group(1).strip()
        if computer_match: event_data['computer'] = computer_match.group(1).strip()
        if id_match: event_data['id'] = id_match.group(1).strip()
        if user_match: event_data['user'] = user_match.group(1).strip()
        
        # Combine Time and ID line for Time parsing
        if time_match and id_match:
            event_data['time'] = time_match.group(1).replace(f"ID: {event_data['id']}", "").strip()
        elif time_match:
             event_data['time'] = time_match.group(1).strip()


        # The message is whatever is left after the 'User:' line
        message_parts = block.split('User:')
        if len(message_parts) > 1:
            message = message_parts[1]
            # remove user from the beginning of the message
            if 'user' in event_data and event_data['user'] in message:
                message = message.replace(event_data['user'], '', 1).strip()
            event_data['message'] = message
        else:
            event_data['message'] = ""
        
        # Ensure all core fields are present before adding
        if all(k in event_data for k in ['record_num', 'source', 'type', 'time', 'id', 'computer', 'user', 'message']):
            events.append(event_data)
            
    return {"psloglist": events} if events else None

@pstools_bp.route('/api/psloglist', methods=['POST'])
def api_psloglist():
    data = request.get_json() or {}
    ip, email, pwd, kind = data.get("ip",""), session.get("email"), session.get("password"), data.get("kind","system")
    try:
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        args = [get_pstools_path("PsLogList.exe"), target_arg] + cred_args + ["-d", "1", kind] # last day
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=120)

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psloglist_output(out)

    return json_result(rc, out, err, structured_data)

def parse_psinfo_output(output):
    data = {
        "system_info": [],
        "disk_info": []
    }
    
    # Use regex to find the system information section more reliably
    system_info_match = re.search(r'System information for .*?:(.*?)(?:Disk information:|$)', output, re.DOTALL)
    if system_info_match:
        content = system_info_match.group(1).strip()
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Regex to match "Key    : Value" format
            match = re.match(r'([^:]+):\s+(.*)', line)
            if match:
                key = match.group(1).strip()
                value = match.group(2).strip()
                data["system_info"].append({"key": key, "value": value})

    # Use regex to find the disk information section
    disk_info_match = re.search(r'Disk information:(.*)', output, re.DOTALL)
    if disk_info_match:
        content = disk_info_match.group(1).strip()
        lines = content.split('\n')
        header_found = False
        for line in lines:
            if 'Volume' in line and 'Size' in line and 'Free' in line:
                header_found = True
                continue
            if header_found and "----" in line:
                continue
            if header_found and line.strip():
                # Flexible split based on 2 or more spaces
                parts = re.split(r'\s{2,}', line.strip())
                if len(parts) >= 5:
                    volume, type_val, size_gb, free_gb, free_percent = parts[:5]
                    data["disk_info"].append({
                        "volume": volume,
                        "type": type_val,
                        "size_gb": size_gb.replace('GB', '').strip(),
                        "free_gb": free_gb.replace('GB', '').strip(),
                        "free_percent": free_percent
                    })
    
    return {"psinfo": data} if data["system_info"] or data["disk_info"] else None


@pstools_bp.route('/api/psinfo', methods=['POST'])
def api_psinfo():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        # Use -d for disk info
        args = [get_pstools_path("PsInfo.exe"), target_arg] + cred_args + ["-d"]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=120)
    
    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psinfo_output(out)
        
    return json_result(rc, out, err, structured_data)

def parse_psloggedon_output(output):
    users = []
    lines = output.strip().split('\n')
    user_section = False
    for line in lines:
        line = line.strip()
        if not line or "Users logged on locally" in line or "No one is logged on locally" in line or "Error" in line:
            continue
        # Section starts after the "Users logged on..." line
        if line.startswith("----"):
            user_section = True
            continue
        if user_section:
            # Regex to capture date/time and username
            match = re.match(r'(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)\s+(.*)', line)
            if match:
                users.append({"time": match.group(1).strip(), "user": match.group(2).strip()})
    return {"psloggedon": users} if users else None

@pstools_bp.route('/api/psloggedon', methods=['POST'])
def api_psloggedon():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        # Correct argument order for PsLoggedOn: exe, credentials, target
        args = [get_pstools_path("PsLoggedOn.exe")] + cred_args + [target_arg]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)

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
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        args = [get_pstools_path("PsShutdown.exe"), target_arg] + cred_args + [flag, "-t", "0", "-n"]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

def parse_psfile_output(output):
    data = []
    lines = output.strip().split('\n')
    header_found = False
    for line in lines:
        line = line.strip()
        if not line or "PsFile" in line or "Copyright" in line:
            continue
        if "Path" in line and "User" in line and "Locks" in line:
            header_found = True
            continue
        if "----" in line:
            continue
        if header_found:
            # The structure is less predictable, so we look for known patterns
            # Assuming format: ID, User, Locks, Path
            parts = [p.strip() for p in re.split(r'\s{2,}', line) if p.strip()]
            if len(parts) >= 4:
                # The path is everything from the 4th element onwards
                 data.append({
                    "id": parts[0],
                    "user": parts[1],
                    "locks": parts[2],
                    "path": ' '.join(parts[3:])
                })
    return {"psfile": data} if data else None


@pstools_bp.route('/api/psfile', methods=['POST'])
def api_psfile():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        args = [get_pstools_path("PsFile.exe"), target_arg] + cred_args
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    
    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psfile_output(out)

    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/api/psgetsid', methods=['POST'])
def api_psgetsid():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    try:
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        args = [get_pstools_path("PsGetSid.exe"), target_arg] + cred_args
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/api/pspasswd', methods=['POST'])
def api_pspasswd():
    data = request.get_json() or {}
    ip, email, pwd = data.get("ip",""), session.get("email"), session.get("password")
    target_user, new_pass = data.get("targetUser",""), data.get("newpass","")
    if not target_user or not new_pass:
        return json_result(2, "", "Target user and new password are required")
    try:
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        args = [get_pstools_path("PsPasswd.exe"), target_arg] + cred_args + [target_user, new_pass]
    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/api/pssuspend', methods=['POST'])
def api_pssuspend():
    data = request.get_json() or {}
    ip, email, pwd, proc = data.get("ip",""), session.get("email"), session.get("password"), data.get("proc","")
    if not proc:
        return json_result(2, "", "Process name or PID is required")
    try:
        target_arg = build_target_arg(ip)
        cred_args = build_remote_args(email, pwd)
        args = [get_pstools_path("PsSuspend.exe"), target_arg] + cred_args + [proc]
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
        args = [get_pstools_path("PsPing.exe")] 
        if extra:
            args += extra.split(' ')
        
        # The target IP should be the last argument if not specified with a flag
        if ip and not any(is_valid_ip(arg) for arg in args):
            args.append(ip)

    except Exception as e:
        return json_result(2, "", str(e))
    rc, out, err = run_cmd(args, timeout=120)
    return json_result(rc, out, err)






