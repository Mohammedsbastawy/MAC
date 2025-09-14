# دوال تشغيل أوامر PsTools (كل API خاصة بالأدوات)
import os
import re
import subprocess
import json
import base64
from flask import Blueprint, request, jsonify, current_app, session
from Tools.utils.helpers import is_valid_ip, get_tools_path, run_ps_command, parse_pslist_output, parse_psloggedon_output, parse_psfile_output, parse_psservice_output, parse_psloglist_output, parse_psinfo_output, run_winrm_command
from Tools.utils.logger import logger

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


pstools_bp = Blueprint('pstools', __name__, url_prefix='/api/pstools')

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
    user, _, _, _ = get_auth_from_request(request.get_json(silent=True) or {})
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
    
    ps_command = """
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
            structured_data = {"pslist": parsed_json}
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
    ip = data.get("ip", "")
    _, _, pwd, winrm_user = get_auth_from_request(data)
    logger.info(f"Executing hardware and OS info query (WinRM) on {ip}.")

    ps_command = """
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem
    $proc = Get-CimInstance -ClassName Win32_Processor
    $gpu = Get-CimInstance -ClassName Win32_VideoController
    
    $uptime_span = (Get-Date) - $os.LastBootUpTime
    $uptime_str = "$($uptime_span.Days) days, $($uptime_span.Hours) hours, $($uptime_span.Minutes) minutes"
    
    $disks = Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' } | ForEach-Object {
        [pscustomobject]@{
            Volume = $_.DriveLetter;
            SizeGB = [math]::Round($_.Size / 1GB, 2);
            FreeGB = [math]::Round($_.SizeRemaining / 1GB, 2);
            FreePercent = "{0}%" -f [math]::Round(($_.SizeRemaining / $_.Size) * 100);
        }
    }

    $system_info = @{
        "OS" = $os.Caption;
        "Kernel version" = $os.Version;
        "Processor" = $proc.Name;
        "Total Memory" = "{0:N2} GB" -f ($cs.TotalPhysicalMemory / 1GB);
        "Video Card" = $gpu.Name;
        "Domain" = $cs.Domain;
        "Uptime" = $uptime_str;
        "Install date" = $os.InstallDate.ToString('yyyy-MM-dd');
        "Logged on users" = $cs.NumberOfUsers;
    }

    @{
        psinfo = @{
            system_info = $system_info.GetEnumerator() | ForEach-Object { @{ key=$_.Name; value=$_.Value } };
            disk_info = $disks
        }
    } | ConvertTo-Json -Depth 3 -Compress
    """
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command, timeout=120)
    
    structured_data = None
    if rc == 0 and out:
        try:
            parsed_json = json.loads(out)
            structured_data = parsed_json
        except json.JSONDecodeError:
            err = f"Failed to parse JSON from WinRM psinfo. Raw output: {out}"
            rc = 1

    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/psloggedon', methods=['POST'])
def api_psloggedon():
    data = request.get_json() or {}
    ip = data.get("ip","")
    _, _, pwd, winrm_user = get_auth_from_request(data)
    logger.info(f"Executing 'query user' (WinRM) on {ip}.")

    ps_command = r"""
    $output = query user
    $results = $output | Select-Object -Skip 1 | ForEach-Object {
        $line = $_.Trim()
        if ($line) {
            # Regex to capture the fields, handling the ">" at the start and variable whitespace
            $match = $line -match '^\s*(>?)([^ ]+)\s+([^ ]+)\s+([0-9]+)\s+([A-Za-z]+)\s+([^ ]+)\s+(.+)';
            if ($match) {
                # The first field (username) might have a '>' prepended
                $username = $match.Groups[2].Value
                [PSCustomObject]@{
                    username     = $username
                    session_name = $match.Groups[3].Value
                    id           = $match.Groups[4].Value
                    state        = $match.Groups[5].Value
                    idle_time    = $match.Groups[6].Value
                    logon_time   = $match.Groups[7].Value
                }
            }
        }
    }
    $results | ConvertTo-Json -Compress
    """
    rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command, timeout=60)

    structured_data = None
    if rc == 0 and out:
        try:
            parsed_json = json.loads(out)
            # Ensure it's always a list
            if isinstance(parsed_json, dict):
                 parsed_json = [parsed_json]
            structured_data = {"psloggedon": parsed_json}
        except json.JSONDecodeError:
            logger.warning(f"Could not parse JSON from psloggedon (WinRM): {out}")
            # If JSON parsing fails, we don't set an error but just return no structured data.
            # This can happen if no users are logged on.
            structured_data = {"psloggedon": []}
    
    return json_result(rc, out, err, structured_data)

@pstools_bp.route('/psshutdown', methods=['POST'])
def api_psshutdown():
    data = request.get_json() or {}
    ip = data.get("ip","")
    action = data.get("action","restart")
    session_id = data.get("session")
    user, domain, pwd, winrm_user = get_auth_from_request(data)
    
    logger.info(f"Executing psshutdown on {ip} with action: '{action}'.")

    if action == 'logoff' and session_id:
        logger.info(f"Attempting to log off session {session_id} on {ip} via WinRM.")
        ps_command = f"logoff {session_id}"
        rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_command)
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

    if not all([ip, user, pwd]):
        return jsonify({'ok': False, 'error': 'IP, email, and password are required.'}), 400


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
    # A non-zero RC isn't always a failure for our goal here.
    if "service has already been started" in err or "WinRM has been updated" in out or "WinRM is already running" in out or rc == 0:
        logger.info(f"Successfully sent WinRM configuration commands to {ip}.")
        return jsonify({
            "ok": True,
            "message": "WinRM configuration commands sent successfully. It may take a moment to apply.",
            "details": out + "\n" + err
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

    # Commands to enable RemoteRegistry and configure the firewall for WMI/RPC and SMB
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
    

    




    