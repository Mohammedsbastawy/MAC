# دوال مساعدة عامة (مثلاً: قراءة config، فحص IP، ...)
import os
import ipaddress
import subprocess
import re
import socket

def is_valid_ip(ip: str) -> bool:
    try:
        ipaddress.ip_address(ip)
        return True
    except Exception:
        return False

def get_hostname_from_ip(ip):
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
        return hostname
    except socket.herror:
        # Unable to resolve hostname
        return None
        
def get_mac_address(ip):
    """
    Returns the MAC address of a device by parsing the ARP table.
    This is more reliable than sending ARP requests for each device.
    It works for devices on the local subnet.
    """
    if not is_valid_ip(ip):
        return None
        
    try:
        # Run the 'arp -a' command
        output = subprocess.check_output(['arp', '-a', ip], text=True, creationflags=subprocess.CREATE_NO_WINDOW)
        
        # Regex to find a MAC address. Handles both '-' and ':' as separators.
        mac_regex = r'([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}'
        match = re.search(mac_regex, output)
        
        if match:
            return match.group(0).upper().replace('-', ':')

    except subprocess.CalledProcessError:
        # This can happen if the IP is not in the ARP cache
        # or if the command fails for other reasons.
        pass
    except Exception:
        # Catch any other unexpected errors
        pass
        
    return None # Return None if not found or an error occurred


def get_tools_path(exe_name: str) -> str:
    """
    Constructs the full path to a Tools executable.
    It assumes the executables are in the 'Tools/bin' directory.
    The executable name should include .exe
    """
    # This assumes the script is in Tools/utils, so we go up two directories.
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    tools_dir = os.path.join(project_root, 'Tools')
    bin_dir = os.path.join(tools_dir, 'bin')

    # The primary location for tools is now Tools/bin
    candidate = os.path.join(bin_dir, exe_name)
    if os.path.isfile(candidate):
        return candidate
    
    # If not found, return the expected path, allowing subprocess to fail with a clear "not found" error.
    return candidate

def run_ps_command(tool_name, ip, username=None, domain=None, pwd=None, extra_args=[], timeout=90, suppress_errors=False):
    """
    A centralized function to build and run any PsTools command.
    tool_name should be 'psexec', 'psinfo', etc. (without .exe)
    ip can be a hostname or an IP address.
    suppress_errors will prevent logging decoding errors, useful for quick checks.
    """
    exe_name = tool_name.capitalize() + ".exe" if not tool_name.lower().endswith('.exe') else tool_name
    
    # Special handling for psping as it takes no credentials
    if tool_name.lower() == 'psping':
        cmd_list = extra_args # psping api passes the full command list
    else:
        base_path = get_tools_path(exe_name)
        cmd_list = [base_path, "-accepteula"]

        # Build credential args
        cred_args = []
        if username and domain:
             # Use the domain\user format
            cred_args += ["-u", f"{domain}\\{username}"]
        elif username:
            # Fallback for local admin
             cred_args += ["-u", username]

        if pwd:
            cred_args += ["-p", pwd]

        # Build target arg
        target_arg = []
        # Allow hostnames or IPs
        if ip:
             target_arg = [f"\\\\{ip}"]
        else:
            # Most PsTools commands require a target
            if tool_name.lower() not in ['psping']:
                 raise ValueError("Invalid or missing IP address for target.")

        # PsLoggedOn requires credentials to come first
        if tool_name.lower() == 'psloggedon':
            cmd_list += cred_args + target_arg
        else:
            cmd_list += target_arg + cred_args
        
        # Add any other arguments
        cmd_list += extra_args
    
    try:
        completed = subprocess.run(
            cmd_list,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,
            timeout=timeout,
            shell=False,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        def decode_output(raw_bytes):
            if not raw_bytes:
                return ""
            # List of encodings to try
            encodings = ['utf-16-le', 'utf-8', 'cp1252', 'latin-1']
            for encoding in encodings:
                try:
                    # Check for BOM in UTF-16
                    if encoding == 'utf-16-le' and not raw_bytes.startswith(b'\xff\xfe'):
                        continue
                    return raw_bytes.decode(encoding)
                except UnicodeDecodeError:
                    continue
            # If all fail, decode with replacement characters
            if suppress_errors:
                return raw_bytes.decode('utf-8', errors='replace')
            else:
                 # Re-raise the error if we can't decode and are not suppressing
                raise UnicodeDecodeError("All decoding attempts failed for raw output.")

        
        out = decode_output(completed.stdout)
        err = decode_output(completed.stderr)
        return completed.returncode, out, err
    except subprocess.TimeoutExpired:
        return 124, "", f"Command timed out after {timeout}s"
    except FileNotFoundError:
        return 127, "", f"Executable not found: {cmd_list[0]}. Ensure it is placed in the Tools/bin directory."
    except Exception as e:
        return 1, "", f"Unexpected error: {e}"

def parse_psinfo_output(output):
    data = { "system_info": [], "disk_info": [] }
    current_section = "system_info"
    
    for line in output.strip().split('\n'):
        line = line.strip()
        if not line or "PsInfo" in line or "Copyright" in line or "System information for" in line:
            continue
        
        if "Disk information:" in line:
            current_section = "disk_info"
            continue
            
        if current_section == "system_info":
            match = re.match(r'([^:]+):\s+(.*)', line)
            if match:
                data["system_info"].append({"key": match.group(1).strip(), "value": match.group(2).strip()})
        
        elif current_section == "disk_info":
            if '----' in line or 'Volume' in line:
                continue
            parts = re.split(r'\s{2,}', line.strip())
            if len(parts) >= 5:
                volume, type_val, size_gb, free_gb, free_percent = parts[:5]
                data["disk_info"].append({
                    "volume": volume, "type": type_val,
                    "size_gb": size_gb.replace('GB', '').strip(),
                    "free_gb": free_gb.replace('GB', '').strip(),
                    "free_percent": free_percent
                })
    
    return {"psinfo": data} if data["system_info"] or data["disk_info"] else None

def parse_pslist_output(output):
    data = []
    lines = output.strip().split('\n')
    header_found = False
    for line in lines:
        line = line.strip()
        if not line or 'PsList' in line or 'Copyright' in line: continue
        if re.match(r'Name\s+Pid', line):
            header_found = True
            continue
        if '----' in line: continue
        if header_found:
            parts = re.split(r'\s{2,}', line)
            if len(parts) >= 8:
                data.append({
                    "name": parts[0], "pid": parts[1], "pri": parts[2],
                    "thd": parts[3], "hnd": parts[4], "priv": parts[5],
                    "cpu_time": parts[6], "elapsed_time": parts[7]
                })
    return {"pslist": data} if data else None

def parse_psloggedon_output(output):
    users = []
    lines = output.strip().split('\n')
    user_section = False
    for line in lines:
        line = line.strip()
        if not line or "Users logged on locally" in line or "No one is logged on locally" in line or "Error" in line: continue
        if line.startswith("----"):
            user_section = True
            continue
        if user_section:
            match = re.match(r'(\d{1,2}/\d{1,2}/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M)\s+(.*)', line)
            if match:
                users.append({"time": match.group(1).strip(), "user": match.group(2).strip()})
    return {"psloggedon": users} if users else None

def parse_psfile_output(output):
    data = []
    lines = output.strip().split('\n')
    header_found = False
    for line in lines:
        line = line.strip()
        if not line or "PsFile" in line or "Copyright" in line: continue
        if "Path" in line and "User" in line and "Locks" in line:
            header_found = True
            continue
        if "----" in line: continue
        if header_found:
            parts = [p.strip() for p in re.split(r'\s{2,}', line) if p.strip()]
            if len(parts) >= 4:
                 data.append({ "id": parts[0], "user": parts[1], "locks": parts[2], "path": ' '.join(parts[3:]) })
    return {"psfile": data} if data else None

def parse_psservice_output(output):
    data = []
    service_blocks = re.split(r'(?=\nSERVICE_NAME:)', output.strip())
    for block in service_blocks:
        if not block.strip() or "PsService" in block or "Copyright" in block: continue
        service_data = {}
        # Use regex to find key-value pairs
        name_match = re.search(r'SERVICE_NAME:\s*(.+)', block)
        display_name_match = re.search(r'DISPLAY_NAME:\s*(.+)', block)
        state_match = re.search(r'STATE\s+:\s*\d+\s+([A-Z_]+)', block)
        type_match = re.search(r'TYPE\s+:\s*[\w\s]+\s+([A-Z_]+(?: [A-Z_]+)*)', block)
        description_match = re.search(r'DISPLAY_NAME:\s*.+?\n((?:.|\n)*?)(?=\n\s*(?:GROUP|TYPE|STATE|WIN32_EXIT_CODE))', block, re.DOTALL)
        if name_match: service_data['name'] = name_match.group(1).strip()
        if display_name_match: service_data['display_name'] = display_name_match.group(1).strip()
        if state_match: service_data['state'] = state_match.group(1).strip()
        if type_match: service_data['type'] = type_match.group(1).strip()
        if description_match:
            desc_lines = [line.strip() for line in description_match.group(1).strip().split('\n')]
            service_data['description'] = ' '.join(desc_lines).strip()
        else:
            service_data['description'] = "No description available."
        if all(k in service_data for k in ['name', 'display_name', 'state', 'type']):
            data.append(service_data)
    return {"psservice": data} if data else None

def parse_psloglist_output(output):
    events = []
    event_blocks = re.split(r'(?=\[\d+\])', output)
    for block in event_blocks:
        block = block.strip()
        if not block or "PsLoglist" in block or "System log on" in block: continue
        event_data = {}
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
        if time_match and id_match:
            event_data['time'] = time_match.group(1).replace(f"ID: {event_data['id']}", "").strip()
        elif time_match:
             event_data['time'] = time_match.group(1).strip()
        message_parts = block.split('User:')
        if len(message_parts) > 1:
            message = message_parts[1]
            if 'user' in event_data and event_data['user'] in message:
                message = message.replace(event_data['user'], '', 1).strip()
            event_data['message'] = message
        else:
            event_data['message'] = ""
        if all(k in event_data for k in ['record_num', 'source', 'type', 'time', 'id', 'computer', 'user', 'message']):
            events.append(event_data)
    return {"psloglist": events} if events else None

    