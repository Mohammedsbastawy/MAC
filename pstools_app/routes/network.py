# كود فحص الشبكة (ARP Scan, Ping Sweep, ...)
import os
import ipaddress
import socket
import threading
import re
from flask import Blueprint, request, jsonify, session
from concurrent.futures import ThreadPoolExecutor, as_completed
from pstools_app.utils.helpers import is_valid_ip, get_pstools_path, run_ps_command, parse_psinfo_output

network_bp = Blueprint('network', __name__)

@network_bp.before_request
def require_login():
    # حماية جميع مسارات الشبكة
    if request.endpoint and request.endpoint.startswith('network.'):
        if 'user' not in session or 'email' not in session:
            return jsonify({'ok': False, 'error': 'يجب تسجيل الدخول أولاً'}), 401

@network_bp.route('/api/network-interfaces', methods=['POST'])
def api_network_interfaces():
    interfaces_list = []
    try:
        # Use a reliable method to get network interfaces
        hostname = socket.gethostname()
        all_addrs = socket.getaddrinfo(hostname, None, socket.AF_INET, socket.SOCK_DGRAM)
        
        for res in all_addrs:
            ip_addr = res[4][0]
            if ip_addr.startswith('127.'):
                continue
            
            try:
                # Attempt to get a netmask to create a proper CIDR
                # This is a bit of a hack for Windows, but often works
                proc = subprocess.run(f'netsh interface ipv4 show addresses name="{ip_addr}"', capture_output=True, text=True, shell=True, timeout=5)
                netmask_line = [line for line in proc.stdout.splitlines() if "Subnet Prefix" in line]
                netmask = "255.255.255.0" # Default
                if netmask_line:
                    # e.g., "Subnet Prefix: 192.168.1.0/24 (mask 255.255.255.0)"
                    match = re.search(r'mask ([\d\.]+)', netmask_line[0])
                    if match:
                        netmask = match.group(1)

                net = ipaddress.ip_network(f"{ip_addr}/{netmask}", strict=False)
                cidr = str(net.with_prefixlen)
                
                if not any(d['cidr'] == cidr for d in interfaces_list):
                    interfaces_list.append({
                        "id": f"iface_{ip_addr}",
                        "name": f"Network ({ip_addr})",
                        "ip": ip_addr,
                        "netmask": netmask,
                        "cidr": cidr
                    })
            except Exception:
                # Fallback for interfaces that we can't get a netmask for
                cidr = f"{ip_addr.rsplit('.', 1)[0]}.0/24"
                if not any(d['cidr'] == cidr for d in interfaces_list):
                     interfaces_list.append({
                        "id": f"fallback_{ip_addr}",
                        "name": f"Network ({cidr})",
                        "ip": ip_addr,
                        "netmask": "255.255.255.0", # Assumption
                        "cidr": cidr
                    })
        
        return jsonify({"ok": True, "interfaces": interfaces_list})
    except Exception as e:
        return jsonify({"ok": False, "error": f"An unexpected error occurred while fetching interfaces: {str(e)}"}), 500


@network_bp.route('/api/discover-devices', methods=['POST'])
def api_discover_devices():
    """
    Performs a fast ping sweep to discover online devices and returns them immediately.
    Details for each device are fetched separately by the frontend.
    """
    data = request.get_json() or {}
    scan_cidr = data.get("cidr")
    if not scan_cidr:
        return jsonify({"ok": False, "error": "CIDR is required for scanning."}), 400

    online_hosts = []
    try:
        net = ipaddress.ip_network(scan_cidr)
        ip_list = [str(ip) for ip in net.hosts()]
        
        def ping_ip(ip_str):
            # The '>nul' part is for Windows to suppress output
            result = os.system(f"ping -n 1 -w 200 {ip_str} >nul 2>&1")
            return ip_str if result == 0 else None

        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_ip = {executor.submit(ping_ip, ip): ip for ip in ip_list}
            for future in as_completed(future_to_ip):
                result = future.result()
                if result:
                    try:
                        hostname = socket.gethostbyaddr(result)[0]
                    except socket.herror:
                        hostname = "Unknown"
                    online_hosts.append({"ip": result, "hostname": hostname})

        sorted_hosts = sorted(online_hosts, key=lambda x: ipaddress.ip_address(x['ip']))
        return jsonify({"ok": True, "devices": sorted_hosts})

    except Exception as e:
        return jsonify({"ok": False, "error": str(e), "devices": []}), 500


@network_bp.route('/api/device-details', methods=['POST'])
def api_device_details():
    """
    Fetches detailed information for a single device using PsInfo.
    This is called by the frontend for each discovered device.
    """
    data = request.get_json() or {}
    ip = data.get('ip')
    if not ip:
        return jsonify({"ok": False, "error": "IP address is required."}), 400
        
    email = session.get("email")
    pwd = session.get("password")
    user_domain = session.get("domain")

    device_details = { "domain": "WORKGROUP", "isDomainMember": False, "os": "Unknown" }
    
    try:
        rc, out, err = run_ps_command("psinfo", ip, email, pwd, ["-d"], timeout=20) # 20s timeout for single device
        if rc == 0 and out:
            psinfo_data = parse_psinfo_output(out)
            if psinfo_data and psinfo_data.get('psinfo'):
                system_info = psinfo_data['psinfo'].get('system_info', [])
                for item in system_info:
                    key = item.get('key','').lower()
                    value = item.get('value','')
                    if key == 'domain':
                        device_details['domain'] = value if value else "WORKGROUP"
                    elif key == 'operating system':
                        device_details['os'] = value

                # Compare with the logged-in user's domain (case-insensitive)
                if user_domain and device_details['domain'].lower() == user_domain.lower():
                    device_details['isDomainMember'] = True
        else:
            # If psinfo fails, we can still say OS is unknown but domain is likely workgroup
            device_details['os'] = f"PsInfo failed: {err or 'Timeout'}"
    except Exception as e:
        device_details['os'] = f"Error: {str(e)}"

    return jsonify(device_details)
