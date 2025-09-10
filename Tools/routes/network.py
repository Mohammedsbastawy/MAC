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
    and then using `arp -a`.
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

    output_file = "masscan_scan.json"
    
    command = [
        masscan_path,
        target_range,
        "-p445",  # Port 445 (SMB) is a good indicator for Windows hosts
        "--rate", "1000",
        "--wait", "0",
        "--output-format", "json",
        "--output-file", output_file
    ]

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

    if proc.returncode != 0:
        # Pass the stderr output for better error reporting in the UI
        raise RuntimeError("Masscan execution failed.", proc.stderr or proc.stdout)

    # Masscan outputs JSON objects on each line, not a valid single JSON array
    # We need to parse it line by line
    found_hosts = []
    if os.path.exists(output_file):
        try:
            with open(output_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    # Masscan might leave an empty "[]" at the end, so we check for actual objects
                    if line.startswith('{') and line.endswith('}'):
                        try:
                            data = json.loads(line)
                            ip = data.get("ip")
                            if ip:
                                found_hosts.append(ip)
                        except json.JSONDecodeError:
                            continue # Ignore malformed lines
            os.remove(output_file)
        finally:
            if os.path.exists(output_file):
                os.remove(output_file)
    
    return found_hosts


def get_device_info(ip):
    """Gets hostname and MAC for a single IP."""
    try:
        hostname = get_hostname_from_ip(ip)
        mac = get_mac_address(ip)
        return {"ip": ip, "hostname": hostname or "Unknown", "mac": mac or "N/A"}
    except Exception as e:
        # Don't let a single failure stop the whole scan
        return {"ip": ip, "hostname": "Error", "mac": "Error"}


@network_bp.route('/api/get-router-mac', methods=['POST'])
def api_get_router_mac():
    mac = get_router_mac_address()
    if mac:
        return jsonify({"ok": True, "mac": mac})
    else:
        return jsonify({"ok": False, "error": "Could not determine router MAC automatically."})


@network_bp.route('/api/discover-devices', methods=['POST'])
def api_discover_devices():
    """
    Performs a fast network discovery using Masscan, then enriches the
    data with information from Active Directory.
    """
    data = request.get_json() or {}
    scan_cidr = data.get("cidr")
    router_mac = data.get("router_mac")
    user_domain = session.get("domain")

    if not scan_cidr:
        return jsonify({"ok": False, "error": "CIDR is required for scanning."}), 400

    try:
        source_ip = get_source_ip_for_cidr(scan_cidr)
        online_ips = run_masscan(scan_cidr, source_ip, router_mac)
        
        # Now get details for each IP in parallel
        online_hosts_basic_info = []
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_ip = {executor.submit(get_device_info, ip): ip for ip in online_ips}
            for future in as_completed(future_to_ip):
                try:
                    result = future.result()
                    if result:
                      online_hosts_basic_info.append(result)
                except Exception as exc:
                    print(f'{future_to_ip[future]} generated an exception: {exc}')

        # Fetch all computer data from Active Directory once
        ad_computers_data = _get_ad_computers_data()
        ad_computers_map = {}
        if ad_computers_data.get('ok'):
             # Create a map for quick lookups using both FQDN and short name
             for comp in ad_computers_data.get('computers', []):
                # DNS hostname is more reliable for matching (FQDN)
                dns_hostname = comp.get('dns_hostname')
                if dns_hostname:
                    ad_computers_map[dns_hostname.lower()] = comp
                # Add the short name (SAMAccountName) as well, without the trailing $
                short_name = comp.get('name')
                if short_name:
                    ad_computers_map[short_name.lower()] = comp
        else:
             # If fetching AD data failed, return that error
             return jsonify(ad_computers_data), 500


        # Enrich the discovered hosts with AD data
        enriched_hosts = []
        for host in online_hosts_basic_info:
            # Check for a match using both the FQDN and the short name
            hostname_lower = host['hostname'].lower() if host['hostname'] else ''
            
            # The resolved hostname might be FQDN or short, so we check both possibilities.
            # We also check just the first part of the FQDN in case that's what matches.
            short_hostname_lower = hostname_lower.split('.')[0]

            ad_info = ad_computers_map.get(hostname_lower) or ad_computers_map.get(short_hostname_lower)
            
            if ad_info:
                # This device is in Active Directory
                enriched_hosts.append({
                    "ip": host['ip'],
                    "hostname": host['hostname'],
                    "mac": host['mac'],
                    "os": ad_info.get('os', 'Unknown OS'),
                    "domain": user_domain,
                    "isDomainMember": True
                })
            else:
                 # This device is not in Active Directory, or hostname couldn't be resolved
                enriched_hosts.append({
                    "ip": host['ip'],
                    "hostname": host['hostname'],
                    "mac": host['mac'],
                    "os": "Unknown OS",
                    "domain": "WORKGROUP",
                    "isDomainMember": False
                })

        sorted_hosts = sorted(enriched_hosts, key=lambda x: ipaddress.ip_address(x['ip']))
        return jsonify({"ok": True, "devices": sorted_hosts})

    except FileNotFoundError:
        return jsonify({
            "ok": False, 
            "error": "Masscan Not Found",
            "message": "masscan.exe was not found in the Tools/bin directory.",
            "error_code": "MASSCAN_NOT_FOUND",
            "details": "Please download the Masscan Windows binary from the official GitHub releases page and place the 'masscan.exe' file in the 'Tools/bin' folder."
        }), 500
    except RuntimeError as e:
        return jsonify({
            "ok": False, 
            "error": "Masscan Scan Failed",
            "message": "The network scan failed. This can happen if Masscan doesn't have the right permissions or can't find the network router.",
            "error_code": "MASSCAN_FAILED",
            "details": e.args[1] if len(e.args) > 1 else str(e)
        }), 500
    except Exception as e:
        return jsonify({
            "ok": False, 
            "error": "Unexpected Scan Error",
            "message": "An unexpected error occurred during the scan.",
            "error_code": "UNEXPECTED_ERROR",
            "details": str(e)
        }), 500
