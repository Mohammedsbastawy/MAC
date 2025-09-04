# كود فحص الشبكة (ARP Scan, Ping Sweep, ...)
import os
import ipaddress
import socket
import threading
import re
import subprocess
from flask import Blueprint, request, jsonify, session
from concurrent.futures import ThreadPoolExecutor, as_completed
from pstools_app.utils.helpers import is_valid_ip, get_pstools_path, run_ps_command, parse_psinfo_output

try:
    from scapy.all import get_if_list, get_if_addr, get_if_hwaddr, conf, srp, Ether, ARP
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False


network_bp = Blueprint('network', __name__)

# This will now act as a cache for the last discovery result
discovered_devices_cache = {"devices": []}
discovery_lock = threading.Lock()


@network_bp.before_request
def require_login():
    # Protect all network endpoints
    if request.endpoint and request.endpoint.startswith('network.'):
        if 'user' not in session or 'email' not in session:
            return jsonify({'ok': False, 'error': 'يجب تسجيل الدخول أولاً'}), 401

def get_domain_computers():
    """
    Gets a list of computer names from Active Directory.
    It tries 'net group' first, then falls back to 'net view'.
    """
    computer_names = set()
    try:
        # This is generally more reliable for getting computer objects
        cmd = 'net group "Domain Computers" /domain'
        proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=60, creationflags=subprocess.CREATE_NO_WINDOW)
        
        if proc.returncode == 0:
            output_lines = proc.stdout.strip().splitlines()
            user_section_started = False
            for line in output_lines:
                if "-------------------------------------------------------------------------------" in line:
                    user_section_started = True
                    continue
                if user_section_started:
                    # Usernames can be in columns, so we split by spaces and filter out empty strings
                    entries = filter(None, line.strip().split('  '))
                    for entry in entries:
                         # Skip the "The command completed successfully." message
                        if "The command completed successfully." not in entry:
                            computer_names.add(entry.strip())
            if computer_names:
                return list(computer_names), None

    except Exception:
        # Ignore errors and fall through to the next method
        pass

    # Fallback to 'net view' if the first method fails or returns nothing
    try:
        cmd = 'net view'
        proc = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=60, creationflags=subprocess.CREATE_NO_WINDOW)
        if proc.returncode != 0:
            return [], f"Failed to query network devices. Error: {proc.stderr or proc.stdout}"

        for line in proc.stdout.splitlines():
            line = line.strip()
            if line.startswith('\\\\'):
                # Remove leading slashes and stop at the first space
                computer_name = line[2:].split(' ')[0]
                computer_names.add(computer_name)
        
        return list(computer_names), None

    except subprocess.TimeoutExpired:
        return [], "Timeout expired while trying to discover domain computers."
    except Exception as e:
        return [], f"An unexpected error occurred during discovery: {str(e)}"

def get_device_info(hostname, email, pwd, user_domain):
    """
    Pings a device to get its IP and status, then gets additional details.
    """
    device_info = {
        "hostname": hostname,
        "ip": "",
        "mac": "-", # MAC is not reliably available without ARP
        "status": "offline",
        "os": "Unknown",
        "domain": "WORKGROUP",
        "isDomainMember": False
    }

    try:
        # 1. Resolve hostname to IP
        ip = socket.gethostbyname(hostname)
        device_info["ip"] = ip

        # 2. Ping the device to check status
        ping_rc = os.system(f"ping -n 1 -w 500 {ip} >nul 2>&1")
        if ping_rc == 0:
            device_info["status"] = "online"
            
            # 3. Get details with PsInfo only if online
            rc, out, err = run_ps_command("psinfo", ip, email, pwd, ["-d"])
            if rc == 0 and out:
                psinfo_data = parse_psinfo_output(out)
                if psinfo_data and psinfo_data.get('psinfo'):
                    system_info = psinfo_data['psinfo'].get('system_info', [])
                    for item in system_info:
                        key = item.get('key','').lower()
                        value = item.get('value','')
                        if key == 'domain':
                            device_info['domain'] = value if value else "WORKGROUP"
                        elif key == 'operating system':
                            device_info['os'] = value
                    
                    if user_domain and device_info['domain'].lower() == user_domain.lower():
                        device_info['isDomainMember'] = True
    
    except socket.gaierror:
        # Cannot resolve hostname, it's effectively offline or doesn't exist
        device_info["status"] = "offline"
    except Exception:
        # Any other exception means we can't get full details, but we have the basics
        pass
    
    return device_info

@network_bp.route('/api/discover-devices', methods=['POST'])
def api_discover_devices():
    user_domain = session.get("domain")
    email = session.get("email")
    pwd = session.get("password")

    # Step 1: Get computer names from Active Directory
    computer_names, error = get_domain_computers()
    if error:
        return jsonify({"ok": False, "error": error, "devices": []}), 500

    if not computer_names:
        return jsonify({"ok": False, "error": "No computers found in the domain.", "devices": []})

    # Step 2: Get details for each computer in parallel
    all_devices = []
    with ThreadPoolExecutor(max_workers=50) as executor:
        future_to_hostname = {executor.submit(get_device_info, name, email, pwd, user_domain): name for name in computer_names}
        for future in as_completed(future_to_hostname):
            try:
                device_info = future.result()
                # We need an IP to be useful
                if device_info.get("ip"):
                    all_devices.append(device_info)
            except Exception:
                # Ignore failures for single devices
                pass
    
    # Sort devices with online first, then alphabetically
    sorted_devices = sorted(all_devices, key=lambda x: (x['status'] == 'offline', x['hostname'].lower()))

    # Cache the result
    with discovery_lock:
        discovered_devices_cache["devices"] = sorted_devices
    
    return jsonify({"ok": True, "devices": sorted_devices})


@network_bp.route('/api/devices', methods=['POST'])
def api_devices():
    """Returns the currently cached list of devices without starting a new scan."""
    with discovery_lock:
        return jsonify({
            "ok": True,
            "devices": list(discovered_devices_cache["devices"]),
        })
