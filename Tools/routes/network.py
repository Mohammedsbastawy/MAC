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
from Tools.utils.helpers import is_valid_ip, get_tools_path, run_ps_command, parse_psinfo_output, get_hostname_from_ip, get_mac_address
from .activedirectory import _get_ad_computers_data

network_bp = Blueprint('network', __name__)

@network_bp.before_request
def require_login():
    # حماية جميع مسارات الشبكة
    if request.endpoint and request.endpoint.startswith('network.'):
        if 'user' not in session or 'email' not in session:
            return jsonify({'ok': False, 'error': 'يجب تسجيل الدخول أولاً'}), 401

def get_source_ip_for_cidr(cidr_str):
    """Finds a local IP address that belongs to the given CIDR network."""
    try:
        target_network = ipaddress.ip_network(cidr_str, strict=False)
        hostname = socket.gethostname()
        addr_info = socket.getaddrinfo(hostname, None)
        
        for item in addr_info:
            # item[4][0] is the IP address
            if item[0] == socket.AF_INET: # Check for IPv4
                ip_addr_str = item[4][0]
                ip_addr = ipaddress.ip_address(ip_addr_str)
                if ip_addr in target_network:
                    return ip_addr_str
    except Exception:
        # Return None if any error occurs
        return None
    return None

def get_router_mac_address():
    """
    Attempts to find the default gateway's MAC address by parsing `route print`
    and then using `arp -a`. This is a more robust method for masscan.
    """
    try:
        # Get the default gateway IP
        route_proc = subprocess.run(
            ["route", "print", "0.0.0.0"],
            capture_output=True, text=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW
        )
        if route_proc.returncode != 0:
            return None

        gateway_ip = None
        for line in route_proc.stdout.splitlines():
            # Look for the default route 0.0.0.0
            if line.strip().startswith("0.0.0.0"):
                parts = line.strip().split()
                if len(parts) >= 3:
                    # The gateway is usually the 3rd part
                    if is_valid_ip(parts[2]):
                        gateway_ip = parts[2]
                        break
        
        if not gateway_ip:
            return None

        # Now that we have the gateway IP, get its MAC from the ARP table
        return get_mac_address(gateway_ip)

    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
        return None
    except Exception:
        return None


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


def run_masscan(target_range, source_ip=None, router_mac=None):
    """Runs masscan to discover devices and returns a list of IPs."""
    masscan_path = get_tools_path("masscan.exe")
    if not os.path.exists(masscan_path):
        raise FileNotFoundError("masscan.exe not found in the Tools/bin directory.")

    # Use a unique filename to avoid race conditions if multiple scans run
    output_file = os.path.join(os.path.dirname(masscan_path), f"masscan_scan_{os.getpid()}.json")
    
    command = [
        masscan_path,
        target_range,
        "-p445",  # Port 445 (SMB) is a good indicator for Windows hosts
        "--rate", "1000",
        "--wait", "0",
        "--output-format", "json",
        "--output-file", output_file
    ]

    # Prioritize router_mac if available, as it's more reliable
    if router_mac:
        command.extend(["--router-mac", router_mac])
    elif source_ip:
        command.extend(["--source-ip", source_ip])

    proc = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=180, # 3 minute timeout
        creationflags=subprocess.CREATE_NO_WINDOW
    )

    if proc.returncode != 0 and "FAIL: could not determine default interface" not in proc.stderr:
        # We ignore the default interface error because we will try other methods.
        # But other errors should be raised.
        raise RuntimeError("Masscan execution failed.", proc.stderr or proc.stdout)

    found_hosts = []
    try:
        if os.path.exists(output_file):
            with open(output_file, 'r') as f:
                content = f.read()
                # Masscan might output an empty file or just a comma on completion, handle this
                if content.strip() and content.strip() != ',':
                    # The JSON is a list of objects, one per line, enclosed in []. Let's fix it.
                    if content.endswith(',\n'):
                        content = content[:-2]
                    json_content = f"[{content}]"
                    
                    try:
                        scan_results = json.loads(json_content)
                        for result in scan_results:
                            ip = result.get("ip")
                            if ip:
                                found_hosts.append(ip)
                    except json.JSONDecodeError as e:
                        # Handle cases where the JSON is still malformed
                         raise RuntimeError("Masscan produced malformed JSON output.", str(e))
    finally:
        if os.path.exists(output_file):
            try:
                os.remove(output_file)
            except OSError:
                pass # Ignore if file is locked
    
    return found_hosts


def get_device_info(ip):
    """Gets hostname and MAC for a single IP."""
    try:
        hostname = get_hostname_from_ip(ip)
        mac = get_mac_address(ip)
        return {"ip": ip, "hostname": hostname or "Unknown", "mac": mac or "N/A"}
    except Exception:
        return {"ip": ip, "hostname": "Error", "mac": "Error"}


@network_bp.route('/api/discover-devices', methods=['POST'])
def api_discover_devices():
    """
    Performs a fast network discovery using Masscan. This is intended to find
    WORKGROUP devices, as domain devices are fetched directly from AD.
    """
    data = request.get_json() or {}
    scan_cidr = data.get("cidr")

    if not scan_cidr:
        return jsonify({"ok": False, "error": "CIDR is required for scanning."}), 400

    try:
        source_ip = get_source_ip_for_cidr(scan_cidr)
        router_mac = get_router_mac_address()
        online_ips = run_masscan(scan_cidr, source_ip, router_mac)
        
        # Get AD computers to filter them out from the scan results
        ad_data = _get_ad_computers_data()
        ad_hostnames = set()
        if ad_data.get('ok'):
             # Create a set of both short names and FQDNs for robust matching
            for computer in ad_data.get('computers', []):
                ad_hostnames.add(computer['name'].lower())
                if computer['dns_hostname']:
                    ad_hostnames.add(computer['dns_hostname'].lower())


        online_hosts_info = []
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_ip = {executor.submit(get_device_info, ip): ip for ip in online_ips}
            for future in as_completed(future_to_ip):
                try:
                    result = future.result()
                    if result:
                      # Check if the discovered host is in the AD list
                      hostname = result.get('hostname', '').lower()
                      if hostname not in ad_hostnames and ('.' in hostname and hostname.split('.')[0] not in ad_hostnames):
                         online_hosts_info.append(result)
                except Exception:
                    pass
        
        # This endpoint now only returns discovered devices. The frontend will filter out
        # any that are already in the domain list.
        sorted_hosts = sorted(online_hosts_info, key=lambda x: ipaddress.ip_address(x['ip']))
        return jsonify({"ok": True, "devices": sorted_hosts})

    except FileNotFoundError:
        return jsonify({
            "ok": False, 
            "error": "Masscan Not Found",
            "message": "masscan.exe was not found in the Tools/bin directory.",
            "error_code": "MASSCAN_NOT_FOUND",
        }), 500
    except RuntimeError as e:
        return jsonify({
            "ok": False, 
            "error": "Masscan Scan Failed",
            "message": "The network scan failed. This can happen if Masscan doesn't have the right permissions or can't find the network router.",
            "error_code": "MASSCAN_FAILED",
            "details": e.args[0] if e.args else str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False, 
            "error": "Unexpected Scan Error",
            "message": "An unexpected error occurred during the scan.",
            "error_code": "UNEXPECTED_ERROR",
            "details": str(e)
        }), 500


def check_host_status_ping(ip):
    """
    Checks if a host is online by sending a single ping.
    Returns True if online, False otherwise.
    """
    try:
        # The '-n 1' sends only one echo request.
        # The '-w 1000' sets a timeout of 1000ms (1 second).
        command = ["ping", "-n", "1", "-w", "1000", ip]
        
        # Use CREATE_NO_WINDOW to prevent flash of a command prompt window
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=2,
            creationflags=subprocess.CREATE_NO_WINDOW
        )
        # A successful ping usually returns 0.
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False
    except Exception:
        return False

def check_host_status_psinfo(ip, user, domain, pwd):
    """
    Checks if a host is responsive by trying to run psinfo.
    This is a fallback for when ping is disabled. Returns True on success.
    """
    try:
        # We use a very short timeout and suppress decoding errors.
        # We only care about the return code, not the output.
        rc, _, _ = run_ps_command("psinfo", ip, user, domain, pwd, ["-d"], timeout=15, suppress_errors=True)
        return rc == 0
    except Exception:
        # If any exception occurs (e.g., in run_ps_command), assume offline.
        return False


@network_bp.route('/api/network/check-status', methods=['POST'])
def api_check_status():
    """
    Receives a list of IPs and checks their online status.
    First tries a fast ping. For any that fail, it tries a slower but more
    reliable PsInfo check, as ping (ICMP) might be blocked by a firewall.
    """
    data = request.get_json() or {}
    ips = data.get("ips", [])
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    
    if not ips:
        return jsonify({"ok": True, "online_ips": []})

    online_by_ping = set()
    offline_after_ping = []

    # Step 1: Fast ping check for all hosts
    with ThreadPoolExecutor(max_workers=50) as executor:
        future_to_ip = {executor.submit(check_host_status_ping, ip): ip for ip in ips}
        for future in as_completed(future_to_ip):
            ip = future_to_ip[future]
            try:
                if future.result():
                    online_by_ping.add(ip)
                else:
                    offline_after_ping.append(ip)
            except Exception:
                offline_after_ping.append(ip)

    online_by_psinfo = set()
    # Step 2: For hosts that failed ping, try PsInfo
    if offline_after_ping:
        with ThreadPoolExecutor(max_workers=20) as executor:
            future_to_ip = {
                executor.submit(check_host_status_psinfo, ip, user, domain, pwd): ip
                for ip in offline_after_ping
            }
            for future in as_completed(future_to_ip):
                ip = future_to_ip[future]
                try:
                    if future.result():
                        online_by_psinfo.add(ip)
                except Exception:
                    pass
    
    # Step 3: Combine results
    final_online_ips = list(online_by_ping.union(online_by_psinfo))
    
    return jsonify({"ok": True, "online_ips": final_online_ips})

    

    

    
