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

# Try to import scapy, but don't fail if it's not there.
# We will check for its availability in the route.
try:
    from scapy.all import ARP, Ether, srp
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False


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
        # This will get all addresses, including IPv6, but we will filter for IPv4
        all_addrs = socket.getaddrinfo(hostname, None)
        
        ipv4_addrs = [addr[4][0] for addr in all_addrs if addr[0] == socket.AF_INET]

        for ip_addr in ipv4_addrs:
            if ip_addr.startswith('127.'):
                continue
            
            try:
                # Use ipaddress module to get interface object, which can create the network object
                iface = ipaddress.ip_interface(f"{ip_addr}/24") # Assume a /24 network for simplicity
                net = iface.network
                cidr = str(net)
                
                # Avoid adding duplicate networks
                if not any(d['cidr'] == cidr for d in interfaces_list):
                    interfaces_list.append({
                        "id": f"iface_{net.network_address}",
                        "name": f"Network ({cidr})",
                        "ip": ip_addr,
                        "netmask": str(net.netmask),
                        "cidr": cidr
                    })
            except ValueError:
                # Fallback for addresses that might not form a valid interface
                continue
        
        return jsonify({"ok": True, "interfaces": interfaces_list})
    except Exception as e:
        return jsonify({"ok": False, "error": f"An unexpected error occurred while fetching interfaces: {str(e)}"}), 500


@network_bp.route('/api/discover-devices', methods=['POST'])
def api_discover_devices():
    """
    Performs a fast ARP scan to discover online devices and returns them immediately.
    Details for each device are fetched separately by the frontend.
    """
    data = request.get_json() or {}
    scan_cidr = data.get("cidr")
    if not scan_cidr:
        return jsonify({"ok": False, "error": "CIDR is required for scanning."}), 400

    online_hosts = []
    try:
        network = ipaddress.ip_network(scan_cidr)
    except ValueError:
        return jsonify({"ok": False, "error": "Invalid CIDR format."}), 400

    # Fallback to Ping Sweep - it's more reliable without external dependencies/permissions.
    def ping_ip(ip):
        try:
            ip_str = str(ip)
            # Use subprocess.run for better control and reliability
            result = subprocess.run(
                ["ping", "-n", "1", "-w", "200", ip_str],
                capture_output=True,
                text=True,
                timeout=1,
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            # Check for TTL in the output, which is a reliable indicator of a successful ping
            if "TTL=" in result.stdout:
                return ip_str
        except (subprocess.TimeoutExpired, Exception):
            pass
        return None

    with ThreadPoolExecutor(max_workers=100) as executor:
        future_to_ip = {executor.submit(ping_ip, ip): ip for ip in network.hosts()}
        for future in as_completed(future_to_ip):
            result_ip = future.result()
            if result_ip:
                hostname = "Unknown"
                try:
                    hostname = socket.gethostbyaddr(result_ip)[0]
                except socket.herror:
                    pass
                online_hosts.append({"ip": result_ip, "mac": "N/A", "hostname": hostname})

    sorted_hosts = sorted(online_hosts, key=lambda x: ipaddress.ip_address(x['ip']))
    return jsonify({"ok": True, "devices": sorted_hosts})


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

    
