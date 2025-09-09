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
    from scapy.all import ARP, Ether, srp, conf
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


def run_masscan(target_range):
    """Runs masscan and returns a list of IPs with open port 445."""
    masscan_path = get_pstools_path("masscan.exe")
    if not os.path.exists(masscan_path):
        raise FileNotFoundError("masscan.exe not found")

    # The --rate option is crucial for performance.
    # The rate should be high, but not so high it overwhelms the network adapter.
    # 10000 is a safe but very fast starting point.
    command = [
        masscan_path,
        target_range,
        "-p445",  # Port 445 (SMB) is a strong indicator of a Windows machine
        "--rate", "10000",
        "--open", # Only show open ports
        "-oG", "-" # Grep-able output to stdout
    ]

    try:
        # Use subprocess.run for better control and error handling
        proc = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=180, # 3-minute timeout, should be more than enough
            check=True,  # This will raise CalledProcessError if masscan returns a non-zero exit code
            creationflags=subprocess.CREATE_NO_WINDOW
        )

        online_hosts = []
        # Parse the grep-able output
        for line in proc.stdout.strip().splitlines():
            if line.startswith("#"):
                continue # Skip comment lines
            parts = line.split()
            # Line format is typically "Host: 192.168.1.1 () Ports: 445/open/tcp////"
            if len(parts) >= 2 and parts[0] == "Host:":
                ip_address = parts[1]
                if is_valid_ip(ip_address):
                     online_hosts.append(ip_address)
        
        return online_hosts

    except subprocess.CalledProcessError as e:
        # This catches errors from masscan itself, e.g., invalid arguments
        raise RuntimeError(f"Masscan execution failed: {e.stderr}")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Masscan scan timed out after 3 minutes.")
    except Exception as e:
        # Catch-all for other unexpected errors
        raise RuntimeError(f"An unexpected error occurred during masscan: {str(e)}")


@network_bp.route('/api/discover-devices', methods=['POST'])
def api_discover_devices():
    """
    Performs a fast port scan using Masscan to discover online devices.
    Returns immediately with the list of discovered devices.
    Details for each device are fetched separately by the frontend.
    """
    data = request.get_json() or {}
    scan_cidr = data.get("cidr")

    if not scan_cidr:
        return jsonify({"ok": False, "error": "CIDR is required for scanning."}), 400

    try:
        online_ips = run_masscan(scan_cidr)
        
        online_hosts = []
        for ip in online_ips:
            hostname = "Unknown"
            try:
                # Resolve hostname if possible, but don't let it slow us down too much.
                # This is a quick check; detailed info comes later.
                hostname = socket.gethostbyaddr(ip)[0]
            except (socket.herror, socket.gaierror):
                pass
            online_hosts.append({"ip": ip, "mac": "-", "hostname": hostname}) # MAC is not provided by masscan

        sorted_hosts = sorted(online_hosts, key=lambda x: ipaddress.ip_address(x['ip']))
        return jsonify({"ok": True, "devices": sorted_hosts})

    except FileNotFoundError:
        return jsonify({
            "ok": False, 
            "error": "Masscan Not Found",
            "error_code": "MASSCAN_NOT_FOUND",
            "details": "masscan.exe was not found in the pstools_app directory. Please download it and place it there."
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False, 
            "error": "Masscan Scan Failed",
            "error_code": "MASSCAN_FAILED",
            "details": str(e)
        }), 500


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

    

    
