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
from Tools.utils.logger import logger

network_bp = Blueprint('network', __name__)

@network_bp.before_request
def require_login():
    # حماية جميع مسارات الشبكة
    if request.endpoint and request.endpoint.startswith('network.'):
        if 'user' not in session or 'email' not in session:
            logger.warning(f"Unauthorized access attempt to {request.endpoint}")
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
                    logger.info(f"Found source IP {ip_addr_str} for CIDR {cidr_str}.")
                    return ip_addr_str
    except Exception as e:
        logger.warning(f"Could not find source IP for CIDR {cidr_str}: {e}")
        return None
    logger.warning(f"No matching local IP found for CIDR {cidr_str}.")
    return None

def get_router_mac_address():
    """
    Attempts to find the default gateway's MAC address by parsing `route print`
    and then using `arp -a`. This is a more robust method for masscan.
    """
    logger.info("Attempting to find router MAC address.")
    try:
        # Get the default gateway IP
        route_proc = subprocess.run(
            ["route", "print", "0.0.0.0"],
            capture_output=True, text=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW
        )
        if route_proc.returncode != 0:
            logger.warning(f"Command 'route print' failed with return code {route_proc.returncode}.")
            return None

        gateway_ip = None
        for line in route_proc.stdout.splitlines():
            if line.strip().startswith("0.0.0.0"):
                parts = line.strip().split()
                if len(parts) >= 3 and is_valid_ip(parts[2]):
                    gateway_ip = parts[2]
                    logger.info(f"Found default gateway IP: {gateway_ip}")
                    break
        
        if not gateway_ip:
            logger.warning("Could not determine default gateway IP from 'route print' output.")
            return None

        # Now that we have the gateway IP, get its MAC from the ARP table
        mac = get_mac_address(gateway_ip)
        if mac:
            logger.info(f"Found MAC address for gateway {gateway_ip}: {mac}")
        else:
            logger.warning(f"Could not find MAC address for gateway {gateway_ip} in ARP table.")
        return mac

    except Exception as e:
        logger.error(f"Error getting router MAC address: {e}", exc_info=True)
        return None


@network_bp.route('/api/network-interfaces', methods=['POST'])
def api_network_interfaces():
    logger.info("Received request for /api/network-interfaces.")
    interfaces_list = []
    try:
        hostname = socket.gethostname()
        all_addrs = socket.getaddrinfo(hostname, None)
        
        ipv4_addrs = [addr[4][0] for addr in all_addrs if addr[0] == socket.AF_INET]

        for ip_addr in ipv4_addrs:
            if ip_addr.startswith('127.'):
                continue
            
            try:
                # Assume a /24 network for simplicity
                iface = ipaddress.ip_interface(f"{ip_addr}/24") 
                net = iface.network
                cidr = str(net)
                
                if not any(d['cidr'] == cidr for d in interfaces_list):
                    interfaces_list.append({
                        "id": f"iface_{net.network_address}",
                        "name": f"Network ({cidr})",
                        "ip": ip_addr,
                        "netmask": str(net.netmask),
                        "cidr": cidr
                    })
            except ValueError:
                continue
        
        logger.info(f"Found {len(interfaces_list)} network interfaces.")
        return jsonify({"ok": True, "interfaces": interfaces_list})
    except Exception as e:
        logger.error(f"Error fetching network interfaces: {e}", exc_info=True)
        return jsonify({"ok": False, "error": f"An unexpected error occurred while fetching interfaces: {str(e)}"}), 500


def run_masscan(target_range, source_ip=None, router_mac=None):
    """Runs masscan to discover devices and returns a list of IPs."""
    masscan_path = get_tools_path("masscan.exe")
    if not os.path.exists(masscan_path):
        logger.error("masscan.exe not found in Tools/bin.")
        raise FileNotFoundError("masscan.exe not found in the Tools/bin directory.")

    output_file = os.path.join(os.path.dirname(masscan_path), f"masscan_scan_{os.getpid()}.json")
    
    command = [masscan_path, target_range, "-p445", "--rate", "1000", "--wait", "0", "--output-format", "json", "--output-file", output_file]

    if router_mac:
        command.extend(["--router-mac", router_mac])
        logger.info(f"Running masscan with router MAC: {router_mac}")
    elif source_ip:
        command.extend(["--source-ip", source_ip])
        logger.info(f"Running masscan with source IP: {source_ip}")
    else:
        logger.warning("Running masscan without a specified router MAC or source IP. This may fail.")

    proc = subprocess.run(command, capture_output=True, text=True, timeout=180, creationflags=subprocess.CREATE_NO_WINDOW)

    if proc.returncode != 0:
        logger.error(f"Masscan failed. RC: {proc.returncode}, Stderr: {proc.stderr}, Stdout: {proc.stdout}")
        if "FAIL: could not determine default interface" not in proc.stderr:
            raise RuntimeError("Masscan execution failed.", proc.stderr or proc.stdout)

    found_hosts = []
    try:
        if os.path.exists(output_file):
            with open(output_file, 'r') as f:
                content = f.read().strip()
                if content and content != ',':
                    if content.endswith(',\n'): content = content[:-2]
                    if content.endswith(','): content = content[:-1]
                    json_content = f"[{content}]"
                    
                    try:
                        scan_results = json.loads(json_content)
                        for result in scan_results:
                            if result.get("ip"):
                                found_hosts.append(result.get("ip"))
                    except json.JSONDecodeError as e:
                         logger.error(f"Masscan produced malformed JSON: {e}. Content: '{content}'")
                         raise RuntimeError("Masscan produced malformed JSON output.", str(e))
    finally:
        if os.path.exists(output_file):
            try: os.remove(output_file)
            except OSError: pass 
    
    logger.info(f"Masscan found {len(found_hosts)} hosts.")
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
    Performs a fast network discovery using Masscan.
    """
    data = request.get_json() or {}
    scan_cidr = data.get("cidr")
    logger.info(f"Received request for /api/discover-devices with CIDR {scan_cidr}.")

    if not scan_cidr:
        logger.warning("Discover devices request failed: Missing CIDR.")
        return jsonify({"ok": False, "error": "CIDR is required for scanning."}), 400

    try:
        source_ip = get_source_ip_for_cidr(scan_cidr)
        router_mac = get_router_mac_address()
        online_ips = run_masscan(scan_cidr, source_ip, router_mac)
        
        ad_data = _get_ad_computers_data()
        ad_hostnames = set()
        if ad_data.get('ok'):
            for computer in ad_data.get('computers', []):
                ad_hostnames.add(computer['name'].lower())
                if computer['dns_hostname']:
                    ad_hostnames.add(computer['dns_hostname'].lower())
        logger.info(f"Loaded {len(ad_hostnames)} AD hostnames to filter from scan results.")

        online_hosts_info = []
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_ip = {executor.submit(get_device_info, ip): ip for ip in online_ips}
            for future in as_completed(future_to_ip):
                try:
                    result = future.result()
                    if result:
                      hostname = result.get('hostname', '').lower()
                      # Filter out devices that are already in AD
                      if hostname not in ad_hostnames and ('.' in hostname and hostname.split('.')[0] not in ad_hostnames):
                         online_hosts_info.append(result)
                except Exception:
                    pass
        
        logger.info(f"Filtered scan results to {len(online_hosts_info)} non-domain devices.")
        sorted_hosts = sorted(online_hosts_info, key=lambda x: ipaddress.ip_address(x['ip']))
        return jsonify({"ok": True, "devices": sorted_hosts})

    except FileNotFoundError as e:
        logger.error("Masscan not found: " + str(e))
        return jsonify({"ok": False, "error": "Masscan Not Found", "message": "masscan.exe was not found in the Tools/bin directory.", "error_code": "MASSCAN_NOT_FOUND"}), 500
    except RuntimeError as e:
        logger.error(f"Masscan runtime error: {e.args[0] if e.args else str(e)}")
        return jsonify({"ok": False, "error": "Masscan Scan Failed", "message": "The network scan failed. This can happen if Masscan doesn't have the right permissions or can't find the network router.", "error_code": "MASSCAN_FAILED", "details": e.args[0] if e.args else str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected scan error: {e}", exc_info=True)
        return jsonify({"ok": False, "error": "Unexpected Scan Error", "message": "An unexpected error occurred during the scan.", "error_code": "UNEXPECTED_ERROR", "details": str(e)}), 500


def check_host_status_ping(ip):
    """Checks if a host is online by sending a single ping. Returns True if online, False otherwise."""
    try:
        command = ["ping", "-n", "1", "-w", "3000", ip]
        result = subprocess.run(command, capture_output=True, text=True, timeout=4, creationflags=subprocess.CREATE_NO_WINDOW)
        return result.returncode == 0
    except Exception:
        return False

def check_host_status_psinfo(ip, user, domain, pwd):
    """Checks if a host is responsive by trying a basic psinfo command. Returns True on success."""
    try:
        rc, _, _ = run_ps_command("psinfo", ip, user, domain, pwd, [], timeout=30, suppress_errors=True)
        return rc == 0
    except Exception as e:
        logger.warning(f"PsInfo check for {ip} failed with exception: {e}")
        return False


@network_bp.route('/api/network/check-status', methods=['POST'])
def api_check_status():
    """
    Receives a list of IPs and checks their online status in a two-step process.
    """
    data = request.get_json() or {}
    ips = data.get("ips", [])
    user, domain, pwd = session.get("user"), session.get("domain"), session.get("password")
    
    if not ips:
        return jsonify({"ok": True, "online_ips": []})

    logger.info(f"Checking online status for {len(ips)} hosts.")
    
    online_by_ping = set()
    offline_after_ping = []

    # Step 1: Fast ping check for all hosts
    logger.info("Starting Phase 1: Ping sweep.")
    with ThreadPoolExecutor(max_workers=50, thread_name_prefix="ping_worker") as executor:
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
    logger.info(f"Ping sweep complete. {len(online_by_ping)} hosts online, {len(offline_after_ping)} to check with PsInfo.")

    online_by_psinfo = set()
    # Step 2: For hosts that failed ping, try PsInfo
    if offline_after_ping:
        logger.info("Starting Phase 2: PsInfo check for offline hosts.")
        with ThreadPoolExecutor(max_workers=20, thread_name_prefix="psinfo_worker") as executor:
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
        logger.info(f"PsInfo check complete. Found {len(online_by_psinfo)} additional hosts online.")
    
    # Step 3: Combine results
    final_online_ips = list(online_by_ping.union(online_by_psinfo))
    logger.info(f"Total online hosts: {len(final_online_ips)}. Sending response.")
    
    return jsonify({"ok": True, "online_ips": final_online_ips})

    