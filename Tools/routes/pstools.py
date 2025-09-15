

# دوال تشغيل أوامر PsTools (كل API خاصة بالأدوات)
import os
import re
import subprocess
import json
import base64
from flask import Blueprint, request, jsonify, current_app, session
from Tools.utils.helpers import is_valid_ip, get_tools_path, run_ps_command, parse_pslist_output, parse_psfile_output, parse_psservice_output, parse_psloglist_output, parse_psinfo_output, parse_query_user_output, run_winrm_command
from Tools.utils.logger import logger
import datetime
import json

pstools_bp = Blueprint('pstools', __name__, url_prefix='/api/pstools')

LOGS_DIR = os.path.join(os.path.dirname(__file__), '..', 'monitoring_logs')
LOG_RETENTION_HOURS = 24


def json_result(rc, out, err, structured_data=None, extra_data={}):
    # Ensure stdout is serializable
    final_stdout = out
    if isinstance(out, (dict, list)):
        try:
            final_stdout = json.dumps(out)
        except TypeError:
            final_stdout = str(out)
    
    ok = rc == 0
    error_message = err if not ok else ""
    
    response = {
        "ok": ok,
        "rc": rc, 
        "stdout": final_stdout, 
        "stderr": err,
        "error": error_message,
        "structured_data": structured_data,
        **extra_data
    }
    
    return jsonify(response), 200



def get_auth_from_request(data):
    """Safely gets auth credentials from request JSON or falls back to session."""
    user = data.get("username") or session.get("user")
    domain = data.get("domain") or session.get("domain")
    pwd = data.get("pwd") or session.get("password")
    
    if not user or not pwd:
        return None, None, None, None

    winrm_user = f"{user}@{domain}" if '@' not in user else user
        
    return user, domain, pwd, winrm_user

@pstools_bp.before_request
def require_login_hook():
    # Allow access to psinfo from the monitoring page which may not have a body
    if request.endpoint == 'pstools.api_psinfo' or request.endpoint == 'pstools.api_deploy_agent':
        if 'user' not in session:
             return jsonify({'ok': False, 'error': 'Authentication required. Please log in.'}), 401
        return
        
    data = request.get_json(silent=True)
    if data is None:
        if 'user' not in session:
            return jsonify({'ok': False, 'error': 'Authentication required. Please log in.'}), 401
        return

    user, _, _, _ = get_auth_from_request(data)
    if not user:
         return jsonify({'ok': False, 'error': 'Authentication required. Please log in.'}), 401


@pstools_bp.route('/psexec', methods=['POST'])
def api_psexec():
    data = request.get_json() or {}
    ip, cmd = data.get("ip",""), data.get("cmd","")
    user, domain, pwd, _ = get_auth_from_request(data)
    
    logger.info(f"Executing psexec on {ip} with command: '{cmd}'")
    if not cmd:
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
    ip = data.get("ip", "")
    _, _, pwd, winrm_user = get_auth_from_request(data)

    logger.info(f"Executing Get-Process (WinRM) on {ip}.")
    
    ps_command = r"""
    $processes = Get-Process
    $total_cpu_seconds = (Get-Counter '\Processor(_Total)\% Processor Time').CounterSamples[0].CookedValue
    $output = @()
    foreach ($proc in $processes) {
        $cpu_time = "N/A"
        if ($proc.CPU -and $total_cpu_seconds -gt 0) {
            $cpu_time = "{0:N2}" -f (($proc.CPU / $total_cpu_seconds) * 100)
        }
        
        $elapsed_time = "N/A"
        if ($proc.StartTime) {
             $ts = (Get-Date) - $proc.StartTime
             $elapsed_time = "{0:00}:{1:00}:{2:00}" -f $ts.Hours, $ts.Minutes, $ts.Seconds
        }

        $output += [PSCustomObject]@{
            Name          = $proc.ProcessName
            Id            = $proc.Id
            Priority      = $proc.PriorityClass
            Threads       = $proc.Threads.Count
            Handles       = $proc.HandleCount
            Memory        = "{0:N0} K" -f ($proc.WorkingSet64 / 1kb)
            CPUTime       = if ($proc.CPU) { "{0:N2}" -f $proc.CPU } else { "0.00" }
            ElapsedTime   = $elapsed_time
        }
    }
    $output | ConvertTo-Json -Compress
    """
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command, timeout=120)

    structured_data = None
    if rc == 0 and out:
        try:
            parsed_json = json.loads(out)
            # Ensure it's always a list
            if isinstance(parsed_json, dict):
                 parsed_json = [parsed_json]
            structured_data = {"pslist": {"pslist": parsed_json}}
        except json.JSONDecodeError:
            err = f"Failed to parse JSON from WinRM pslist. Raw output: {out}"
            rc = 1

    return json_result(rc, out, err, structured_data)


@pstools_bp.route('/pskill', methods=['POST'])
def api_pskill():
    data = request.get_json() or {}
    ip, proc_id = data.get("ip",""), data.get("proc","")
    _, _, pwd, winrm_user = get_auth_from_request(data)
    
    logger.info(f"Executing Stop-Process (WinRM) on {ip} for PID: '{proc_id}'.")
    if not proc_id:
        return json_result(2, "", "Process PID is required")
        
    try:
        pid = int(proc_id)
    except ValueError:
        return json_result(2, "", "Invalid Process ID. Must be a number.")

    ps_command = f"Stop-Process -Id {pid} -Force -ErrorAction Stop"
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command, timeout=60)
    return json_result(rc, out, err)


@pstools_bp.route('/psloglist', methods=['POST'])
def api_psloglist():
    data = request.get_json() or {}
    ip, kind = data.get("ip",""), data.get("kind","system")
    user, domain, pwd, _ = get_auth_from_request(data)
    logger.info(f"Executing psloglist on {ip} for log type: '{kind}'.")
    rc, out, err = run_ps_command("psloglist", ip, user, domain, pwd, ["-d", "1", kind], timeout=120)

    structured_data = None
    if rc == 0 and out:
        structured_data = parse_psloglist_output(out)

    return json_result(rc, out, err, structured_data)


@pstools_bp.route('/psinfo', methods=['POST'])
def api_psinfo():
    data = request.get_json() or {}
    ip = data.get("ip")
    device_name = data.get("name")
    user, domain, pwd, winrm_user = get_auth_from_request(data)
    
    if not ip or not device_name:
        return json_result(1, "", "IP address and device name are required.", None)

    logger.info(f"Reading performance data for '{device_name}' from agent file on {ip}.")
    
    # Path to the agent's data file on the remote machine
    remote_file_path = f"C:\\Atlas\\{device_name}.json"
    ps_command = f"Get-Content -Path '{remote_file_path}' -Raw"

    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command, timeout=15)
    
    if rc != 0:
        logger.warning(f"Failed to read agent file from {ip} for {device_name}. Error: {err}")
        return json_result(rc, out, err)

    try:
        perf_data = json.loads(out)
        structured_data = {"psinfo": perf_data}

        # --- Historical Logging ---
        log_file = os.path.join(LOGS_DIR, f"{device_name}.json")
        history = []
        if os.path.exists(log_file):
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    history = json.load(f)
            except (IOError, json.JSONDecodeError):
                history = []
        
        history.append({
            "timestamp": perf_data.get("timestamp", datetime.datetime.utcnow().isoformat()),
            "cpuUsage": perf_data.get("cpuUsage"),
            "usedMemoryGB": perf_data.get("usedMemoryGB")
        })

        retention_delta = datetime.timedelta(hours=LOG_RETENTION_HOURS)
        now = datetime.datetime.utcnow()
        try:
            history = [
                entry for entry in history
                if now - datetime.datetime.fromisoformat(entry["timestamp"].replace('Z','+00:00')) < retention_delta
            ]
        except (TypeError, ValueError):
            # If timestamps are bad, just keep the latest 500 entries as a fallback
             history = history[-500:]

        
        try:
            with open(log_file, 'w') as f:
                json.dump(history, f)
        except IOError as e:
            logger.error(f"Failed to write history log for {device_name}: {e}")

        return json_result(0, json.dumps(perf_data), "", structured_data)

    except json.JSONDecodeError as e:
        logger.error(f"Error decoding JSON from agent file for {device_name}: {e}. Raw data: {out}")
        return json_result(500, out, f"Failed to parse data file from agent. The file may be corrupted or malformed.", None)
    except Exception as e:
        logger.error(f"Unexpected error processing agent data for {device_name}: {e}", exc_info=True)
        return json_result(500, "", f"An unexpected error occurred while processing data for {device_name}.", None)


@pstools_bp.route('/psloggedon', methods=['POST'])
def api_psloggedon():
    data = request.get_json() or {}
    ip = data.get("ip", "")
    _, _, pwd, winrm_user = get_auth_from_request(data)
    
    logger.info(f"Executing quser.exe (WinRM) on {ip}.")
    
    ps_command = r"""
    $output = quser.exe
    $results = $output | Select-Object -Skip 1 | ForEach-Object {
        $line = $_.Trim() -replace '\s{2,}', ','
        $parts = $line.Split(',')
        if ($parts.Length -ge 5) {
            $username = $parts[0].Replace('>', '').Trim()
            $session_name = $parts[1].Trim()
            $id = $parts[2].Trim()
            $state = $parts[3].Trim()
            $logon_time = $parts[4..($parts.Length-1)] -join ' '
            
            [PSCustomObject]@{
                username     = $username
                session_name = $session_name
                id           = $id
                state        = $state
                idle_time    = "" # Quser doesn't provide this easily
                logon_time   = $logon_time.Trim()
            }
        }
    }
    $results | ConvertTo-Json -Compress
    """

    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command, timeout=30)
    
    if rc != 0:
        logger.error(f"quser.exe command via WinRM failed on {ip} with RC={rc}. Stderr: {err}")
        return json_result(rc, out, err, structured_data={"psloggedon": []})
    
    parsed_users = []
    if out and out.strip() and out.strip() != "null":
        try:
            parsed_json = json.loads(out)
            if isinstance(parsed_json, dict):
                parsed_users = [parsed_json]
            else:
                parsed_users = parsed_json
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON from WinRM on {ip}. Raw output: {out}")
            err = f"Failed to parse user data from remote host: {out}"
            rc = 1
    
    return json_result(rc, out, err, structured_data={"psloggedon": parsed_users})


@pstools_bp.route('/psshutdown', methods=['POST'])
def api_psshutdown():
    data = request.get_json() or {}
    ip, action = data.get("ip",""), data.get("action","restart")
    session_id = data.get("session")
    user, domain, pwd, winrm_user = get_auth_from_request(data)
    
    logger.info(f"Executing shutdown/restart/logoff on {ip} with action: '{action}'.")

    if action == 'logoff' and session_id:
        logger.info(f"Attempting to log off session {session_id} on {ip} via WinRM.")
        rc, out, err = run_winrm_command(ip, winrm_user, pwd, f"logoff {session_id}", type='cmd')
        if rc != 0 and not err:
            err = f"Failed to logoff session {session_id}. The user may have already logged off, or you may not have permission."
        return json_result(rc, out, err)

    flag = {"restart": "-r", "shutdown": "-s"}.get(action)
    if not flag:
        return json_result(2, "", "Invalid power action")
    
    args = [flag, "-t", "0", "-f"]
    rc, out, err = run_ps_command("psshutdown", ip, user, domain, pwd, args, timeout=60)
    return json_result(rc, out, err)


@pstools_bp.route('/psfile', methods=['POST'])
def api_psfile():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd, _ = get_auth_from_request(data)
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
    logger.info(f"Executing psgetsid on {ip}.")
    rc, out, err = run_ps_command("psgetsid", ip, user, domain, pwd, [], timeout=60)
    return json_result(rc, out, err)

@pstools_bp.route('/pspasswd', methods=['POST'])
def api_pspasswd():
    data = request.get_json() or {}
    ip = data.get("ip","")
    user, domain, pwd, _ = get_auth_from_request(data)
    target_user, new_pass = data.get("targetUser",""), data.get("newpass","")
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
    path = data.get("path", "")
    user, domain, pwd, winrm_user = get_auth_from_request(data)

    logger.info(f"Executing file browse (WinRM) on {ip} for path: '{path or 'drives'}'")
    
    if path and path != "drives":
        clean_path = path.replace("'", "").replace('"', '')
        if ".." in clean_path or not (re.match(r"^[a-zA-Z]:\\?$", clean_path) or re.match(r"^[a-zA-Z]:\\[\\\S|*`()\[\]{}?].*$", clean_path)):
            logger.warning(f"Invalid or unsafe path blocked: '{path}'")
            return json_result(1, "", "Invalid or unsafe path format.")
        
        ps_command = f"""
        Get-ChildItem -Path '{clean_path}' -Force -ErrorAction SilentlyContinue | 
        Select-Object Name, FullName, Length, @{{Name='LastWriteTime';Expression={{$_.LastWriteTime.ToUniversalTime().ToString('o')}}}}, @{{Name='Mode';Expression={{$_.Mode.ToString()}}}} | 
        ConvertTo-Json -Compress
        """
    else:
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
    if rc == 0 and out.strip():
        try:
            parsed_json = json.loads(out)
            structured_data = {"psbrowse": [parsed_json] if not isinstance(parsed_json, list) else parsed_json}
        except json.JSONDecodeError:
            err = f"Failed to parse JSON from WinRM. Raw output: {out}"
            rc = 1
    elif rc == 0:
        structured_data = {"psbrowse": []}
    
    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/download-file', methods=['POST'])
def download_file():
    data = request.get_json() or {}
    ip, path = data.get("ip"), data.get("path")
    _, _, pwd, winrm_user = get_auth_from_request(data)
    
    if not path:
        return json_result(1, "", "File path is required.")
        
    logger.info(f"Initiating download for '{path}' from {ip}")
    ps_command = f"$bytes = Get-Content -Path '{path}' -Encoding Byte -Raw; [System.Convert]::ToBase64String($bytes)"
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command, timeout=300)
    
    return json_result(rc, "", err, extra_data={"content": out.strip()})


@pstools_bp.route('/upload-file', methods=['POST'])
def upload_file():
    data = request.get_json() or {}
    ip, dest_path, content_b64 = data.get("ip"), data.get("destinationPath"), data.get("fileContent")
    _, _, pwd, winrm_user = get_auth_from_request(data)
    
    if not all([dest_path, content_b64]):
        return json_result(1, "", "Destination path and file content are required.")
    
    logger.info(f"Initiating upload to '{dest_path}' on {ip}")
    # We send the content in chunks to avoid PowerShell command length limits
    chunk_size = 8000 
    chunks = [content_b64[i:i + chunk_size] for i in range(0, len(content_b64), chunk_size)]
    
    # Command to create/overwrite the file
    ps_command_create = f"$path = '{dest_path}'; $data = [System.Convert]::FromBase64String('{chunks[0]}'); [System.IO.File]::WriteAllBytes($path, $data)"
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command_create)
    if rc != 0:
        logger.error(f"Upload failed (initial chunk) to {dest_path} on {ip}. Error: {err}")
        return json_result(rc, out, f"Failed to create file on remote host. {err}")
        
    # Commands to append subsequent chunks
    for chunk in chunks[1:]:
        ps_command_append = f"$path = '{dest_path}'; $data = [System.Convert]::FromBase64String('{chunk}'); [System.IO.File]::AppendAllBytes($path, $data)"
        rc_append, out_append, err_append = run_winrm_command(ip, winrm_user, pwd, ps_command_append)
        if rc_append != 0:
            logger.error(f"Upload failed (append chunk) to {dest_path} on {ip}. Error: {err_append}")
            return json_result(rc_append, out_append, f"Failed during file append. {err_append}")
            
    logger.info(f"Successfully uploaded file to '{dest_path}' on {ip}")
    return json_result(0, "Upload successful", "", {"message": "File uploaded successfully."})

@pstools_bp.route('/delete-item', methods=['POST'])
def delete_item():
    data = request.get_json() or {}
    ip, path = data.get("ip"), data.get("path")
    _, _, pwd, winrm_user = get_auth_from_request(data)
    ps_command = f"Remove-Item -Path '{path}' -Recurse -Force -ErrorAction Stop"
    logger.info(f"Attempting to delete '{path}' on {ip}")
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command)
    return json_result(rc, out, err, {"message": f"Successfully deleted {os.path.basename(path)}."})

@pstools_bp.route('/rename-item', methods=['POST'])
def rename_item():
    data = request.get_json() or {}
    ip, path, new_name = data.get("ip"), data.get("path"), data.get("newName")
    _, _, pwd, winrm_user = get_auth_from_request(data)
    ps_command = f"Rename-Item -Path '{path}' -NewName '{new_name}' -ErrorAction Stop"
    logger.info(f"Attempting to rename '{path}' to '{new_name}' on {ip}")
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command)
    return json_result(rc, out, err, {"message": f"Successfully renamed to {new_name}."})

@pstools_bp.route('/create-folder', methods=['POST'])
def create_folder():
    data = request.get_json() or {}
    ip, path = data.get("ip"), data.get("path")
    _, _, pwd, winrm_user = get_auth_from_request(data)
    ps_command = f"New-Item -Path '{path}' -ItemType Directory -Force -ErrorAction Stop"
    logger.info(f"Attempting to create folder '{path}' on {ip}")
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command)
    return json_result(rc, out, err, {"message": f"Successfully created folder {os.path.basename(path)}."})


@pstools_bp.route('/enable-winrm', methods=['POST'])
def api_enable_winrm():
    data = request.get_json() or {}
    ip = data.get("ip")
    user, domain, pwd, _ = get_auth_from_request(data)

    logger.info(f"Attempting to robustly enable WinRM on {ip} using PsExec.")

    # Note: Double quotes inside the command need to be escaped for the shell.
    chained_command = (
        'winrm quickconfig -q && '
        'sc config winrm start= auto && '
        'net start winrm && '
        'netsh advfirewall firewall set rule group="Windows Remote Management" new enable=yes'
    )
    
    cmd_args = ["cmd", "/c", chained_command]

    rc, out, err = run_ps_command("psexec", ip, user, domain, pwd, cmd_args, timeout=180)
    
    # Check for success messages in stdout, even if RC is non-zero (e.g. service already started)
    # RC 2 can mean the service was already started, which is not a failure for our goal.
    if rc == 0 or (rc != 0 and "service has already been started" in err):
        logger.info(f"Successfully sent WinRM configuration commands to {ip}.")
        final_message = out + "\n" + err if err else out
        return jsonify({
            "ok": True,
            "message": "WinRM configuration commands sent successfully. It may take a moment to apply.",
            "details": final_message
        })
    else:
        logger.error(f"Failed to enable WinRM on {ip} via PsExec. RC={rc}. Stderr: {err}. Stdout: {out}")
        return jsonify({
            "ok": False,
            "error": "Failed to execute remote command via PsExec.",
            "details": err or out
        }), 500


@pstools_bp.route('/enable-prereqs', methods=['POST'])
def api_enable_prereqs():
    data = request.get_json() or {}
    ip = data.get("ip")
    user, domain, pwd, _ = get_auth_from_request(data)

    logger.info(f"Attempting to enable prerequisites (RPC/WMI) on {ip} using PsExec.")

    chained_command = (
        'sc config "RemoteRegistry" start= auto && '
        'net start "RemoteRegistry" && '
        'netsh advfirewall firewall set rule group="windows management instrumentation (wmi)" new enable=yes && '
        'netsh advfirewall firewall set rule group="remote administration" new enable=yes && '
        'netsh advfirewall firewall set rule group="file and printer sharing" new enable=yes'
    )
    
    cmd_args = ["cmd", "/c", chained_command]

    rc, out, err = run_ps_command("psexec", ip, user, domain, pwd, cmd_args, timeout=180)
    
    if rc == 0 or (rc != 0 and ("service has already been started" in err or "No rules match the specified criteria" in err)):
        logger.info(f"Successfully sent prerequisite configuration commands to {ip}.")
        final_message = out + "\n" + err
        return jsonify({
            "ok": True,
            "message": "Prerequisite configuration commands sent successfully. Some services may have already been running or rules enabled, which is expected.",
            "details": final_message
        })
    else:
        logger.error(f"Failed to enable prerequisites on {ip} via PsExec. RC={rc}. Stderr: {err}. Stdout: {out}")
        return jsonify({
            "ok": False,
            "error": "Failed to execute remote prerequisite commands via PsExec.",
            "details": err or out
        }), 500

@pstools_bp.route('/set-network-private', methods=['POST'])
def api_set_network_private():
    data = request.get_json() or {}
    ip = data.get("ip")
    user, domain, pwd, _ = get_auth_from_request(data)

    logger.info(f"Attempting to set network profile to Private on {ip} using PsExec.")

    # This command attempts to run PowerShell with elevated privileges to change the network profile.
    ps_command = 'Get-NetConnectionProfile | Set-NetConnectionProfile -NetworkCategory Private'
    cmd_args = ["powershell.exe", "-Command", ps_command]
    
    rc, out, err = run_ps_command("psexec", ip, user, domain, pwd, cmd_args, timeout=180)

    if rc == 0:
        logger.info(f"Successfully sent command to set network profile to Private on {ip}.")
        return jsonify({
            "ok": True,
            "message": "Command to set network profile to 'Private' was sent successfully. It may take a moment for the change to apply.",
            "details": out
        })
    else:
        logger.error(f"Failed to set network profile on {ip}. RC={rc}. Stderr: {err}. Stdout: {out}")
        return jsonify({
            "ok": False,
            "error": "Failed to execute remote command to set network profile.",
            "details": err or out
        }), 500

@pstools_bp.route('/deploy-agent', methods=['POST'])
def api_deploy_agent():
    data = request.get_json() or {}
    ip = data.get("ip")
    user, domain, pwd, _ = get_auth_from_request(data)
    
    if not ip:
        return jsonify({"ok": False, "error": "IP address is required."}), 400

    logger.info(f"Starting agent deployment on {ip}.")

    # --- Step 1: Create C:\Atlas folder ---
    logger.info(f"Step 1/3: Creating C:\\Atlas directory on {ip}.")
    mkdir_rc, mkdir_out, mkdir_err = run_ps_command("psexec", ip, user, domain, pwd, ["cmd", "/c", "mkdir", "C:\\Atlas"], timeout=60)
    # We don't fail if the directory already exists (which is a common error)
    if mkdir_rc != 0 and "A subdirectory or file C:\\Atlas already exists" not in mkdir_err:
        logger.error(f"Failed to create directory on {ip}: {mkdir_err}")
        return jsonify({"ok": False, "error": "Failed to create remote directory.", "details": mkdir_err}), 500

    # --- Step 2: Copy the agent script ---
    # The script is located in Tools/scripts/AtlasMonitorAgent.ps1
    agent_script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts', 'AtlasMonitorAgent.ps1'))
    if not os.path.exists(agent_script_path):
        logger.error(f"Agent script not found at {agent_script_path}")
        return jsonify({"ok": False, "error": "Agent script file is missing from the server."}), 500

    logger.info(f"Step 2/3: Copying agent script to {ip}.")
    # PsExec's -c switch copies the file and runs it. Let's use it to just copy.
    # A more reliable way is to copy it to a share, but let's try psexec's capability.
    # The command `psexec -c <local_file> <remote_command>` copies and runs.
    # We will copy it to a specific location on C$
    copy_rc, copy_out, copy_err = run_ps_command("psexec", ip, user, domain, pwd, ["-c", agent_script_path, "cmd", "/c", "move", f"C:\\Windows\\{os.path.basename(agent_script_path)}", "C:\\Atlas\\AtlasMonitorAgent.ps1"], timeout=120)
    if copy_rc != 0:
        # Retry with xcopy just in case
        copy_rc, copy_out, copy_err = run_ps_command("psexec", ip, user, domain, pwd, ["cmd", "/c", f'xcopy /Y "{agent_script_path}" \\\\{ip}\\C$\\Atlas\\'], timeout=120)
        if copy_rc != 0:
            logger.error(f"Failed to copy script to {ip}: {copy_err}")
            return jsonify({"ok": False, "error": "Failed to copy agent script.", "details": f"{copy_err} {copy_out}"}), 500


    # --- Step 3: Create the scheduled task ---
    logger.info(f"Step 3/3: Creating scheduled task on {ip}.")
    task_command = (
        'schtasks /create /tn "AtlasAgent" '
        '/tr "powershell.exe -ExecutionPolicy Bypass -NoProfile -File C:\\Atlas\\AtlasMonitorAgent.ps1" '
        '/sc minute /mo 1 /f /ru "SYSTEM"'
    )
    task_rc, task_out, task_err = run_ps_command("psexec", ip, user, domain, pwd, ["cmd", "/c", task_command], timeout=120)
    if task_rc != 0:
        logger.error(f"Failed to create scheduled task on {ip}: {task_err}")
        return jsonify({"ok": False, "error": "Failed to create scheduled task.", "details": task_err}), 500
        
    logger.info(f"Agent deployment successful on {ip}.")
    return jsonify({
        "ok": True,
        "message": f"Agent deployed successfully on {ip}. It will start sending data within a minute."
    })
