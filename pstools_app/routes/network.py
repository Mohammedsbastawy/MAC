# كود فحص الشبكة (ARP Scan, Ping Sweep, ...)
import os
import ipaddress
import socket
import threading
import re
import subprocess
import time
import json
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


def parse_bettercap_output(output):
    """Parses the table-like output from bettercap's net.show command."""
    hosts = []
    # Regex to capture the fields from the net.show table
    # It looks for lines starting with a pipe and captures the content of each column
    line_regex = re.compile(
        r"^\s*\|\s*(?P<ip>[\d\.]+)\s*\|\s*(?P<mac>[\w:]+)\s*\|\s*(?P<hostname>.*?)\s*\|.*"
    )
    
    for line in output.splitlines():
        match = line_regex.match(line)
        if match:
            host_data = match.groupdict()
            # Clean up default/empty values from bettercap
            if host_data['mac'] == "00:00:00:00:00:00": continue
            if not is_valid_ip(host_data['ip']): continue

            hosts.append({
                "ip": host_data['ip'].strip(),
                "mac": host_data['mac'].strip().upper(),
                "hostname": host_data['hostname'].strip() if host_data['hostname'].strip() else "Unknown"
            })
            
    return hosts

def run_bettercap(target_range):
    """Runs bettercap to discover devices and returns a list of hosts."""
    bettercap_path = get_pstools_path("bettercap.exe")
    if not os.path.exists(bettercap_path):
        raise FileNotFoundError("bettercap.exe not found")

    # Command to start network probing, wait, show results, and quit.
    # The output is saved to a temp json file.
    temp_output_file = "bettercap_scan.json"
    command = [
        bettercap_path,
        "-no-colors",
        "-eval",
        f"set net.probe.targets {target_range}; net.probe on; sleep 5; net.show -json-file {temp_output_file}; q"
    ]

    try:
        proc = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=180, # 3 minute timeout
            check=True,
            creationflags=subprocess.CREATE_NO_WINDOW
        )

        if os.path.exists(temp_output_file):
            with open(temp_output_file, 'r') as f:
                scan_data = json.load(f)
            os.remove(temp_output_file) # Clean up the file
            
            online_hosts = []
            for host in scan_data.get('hosts', []):
                 if host['ip'] and host['mac']: # Ensure essential data exists
                     online_hosts.append({
                        "ip": host['ip'],
                        "mac": host['mac'],
                        "hostname": host.get('hostname', 'Unknown') or 'Unknown'
                     })
            return online_hosts
        else:
             # Fallback parsing in case json output fails for some reason
            return parse_bettercap_output(proc.stdout)

    except FileNotFoundError:
        # This is redundant due to the check above, but good practice
        raise
    except subprocess.CalledProcessError as e:
        # This can happen if bettercap can't find npcap
        stderr = e.stderr.lower()
        if "could not find any pcap" in stderr or "npcap" in stderr:
            raise RuntimeError("Bettercap requires Npcap to be installed. Please install it and try again.")
        raise RuntimeError(f"Bettercap execution failed: {e.stderr}")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Bettercap scan timed out after 3 minutes.")
    except Exception as e:
        raise RuntimeError(f"An unexpected error occurred during Bettercap scan: {str(e)}")


@network_bp.route('/api/discover-devices', methods=['POST'])
def api_discover_devices():
    """
    Performs a fast network discovery using Bettercap.
    """
    data = request.get_json() or {}
    scan_cidr = data.get("cidr")

    if not scan_cidr:
        return jsonify({"ok": False, "error": "CIDR is required for scanning."}), 400

    try:
        online_hosts = run_bettercap(scan_cidr)
        sorted_hosts = sorted(online_hosts, key=lambda x: ipaddress.ip_address(x['ip']))
        return jsonify({"ok": True, "devices": sorted_hosts})

    except FileNotFoundError:
        return jsonify({
            "ok": False, 
            "error": "Bettercap Not Found",
            "error_code": "BETTERCAP_NOT_FOUND",
            "details": "bettercap.exe was not found in the pstools_app directory. Please download it and place it there."
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False, 
            "error": "Bettercap Scan Failed",
            "error_code": "BETTERCAP_FAILED",
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

    

    
