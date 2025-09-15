
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
from Tools.utils.helpers import is_valid_ip, get_tools_path, run_ps_command, parse_psinfo_output, get_hostname_from_ip, get_mac_address, run_winrm_command
from .activedirectory import _get_ad_computers_data
from Tools.utils.logger import logger
import datetime

network_bp = Blueprint('network', __name__)

CACHE_FILE = os.path.join(os.path.dirname(__file__), '..', 'monitoring_cache.json')
CACHE_EXPIRY_SECONDS = 60 # 1 minute

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
                    # Fix for masscan's sometimes-broken JSON
                    if content.startswith('[\n'): content = content[2:]
                    if content.endswith('\n]'): content = content[:-2]
                    if content.endswith(','): content = content[:-1]
                    
                    json_content = f"[{content}]"
                    
                    try:
                        scan_results = json.loads(json_content)
                        for result in scan_results:
                            # Handle different possible JSON output formats from masscan
                            ip_to_add = None
                            if isinstance(result, dict) and result.get("ip"):
                                ip_to_add = result.get("ip")
                            elif isinstance(result, list) and len(result) > 0:
                                # Check the first element of the inner list
                                inner_item = result[0]
                                if isinstance(inner_item, dict) and 'ip' in inner_item:
                                     ip_to_add = inner_item.get('ip')
                            
                            if ip_to_add:
                                found_hosts.append(ip_to_add)

                    except json.JSONDecodeError as e:
                         logger.error(f"Masscan produced malformed JSON: {e}. Content: '{content}'")
                         # Try parsing as list of lists as a fallback
                         try:
                             lines = content.split('},')
                             for line in lines:
                                 if '"ip":' in line:
                                     ip_match = re.search(r'"ip":\s*"([^"]+)"', line)
                                     if ip_match:
                                         found_hosts.append(ip_match.group(1))
                         except Exception:
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
    The backend now filters out known domain devices before returning results.
    """
    data = request.get_json() or {}
    scan_cidr = data.get("cidr")
    logger.info(f"Received request for /api/discover-devices with CIDR {scan_cidr}.")

    if not scan_cidr:
        logger.warning("Discover devices request failed: Missing CIDR.")
        return jsonify({"ok": False, "error": "CIDR is required for scanning."}), 400

    try:
        # Step 1: Run the network scan
        source_ip = get_source_ip_for_cidr(scan_cidr)
        router_mac = get_router_mac_address()
        online_ips = run_masscan(scan_cidr, source_ip, router_mac)
        
        # Step 2: Get info for discovered IPs
        online_hosts_info = []
        with ThreadPoolExecutor(max_workers=50) as executor:
            future_to_ip = {executor.submit(get_device_info, ip): ip for ip in online_ips}
            for future in as_completed(future_to_ip):
                try:
                    result = future.result()
                    if result:
                        online_hosts_info.append(result)

                except Exception as e:
                    logger.warning(f"Error processing device info future: {e}")

        logger.info(f"Discovered {len(online_hosts_info)} devices on the network.")
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

def check_host_status_tcp_connect(ip):
    """
    Checks if a host is responsive by trying to connect to common Windows ports.
    Returns True on the first successful connection.
    """
    # Ports: RPC (135), SMB (445), WinRM (5985), RDP (3389)
    ports_to_check = [135, 445, 5985, 3389]
    for port in ports_to_check:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1.0)  # 1 second timeout for each port
            try:
                if s.connect_ex((ip, port)) == 0:
                    # logger.info(f"Host {ip} is online, responded on port {port}.")
                    return True
            except (socket.timeout, socket.error):
                continue
    return False


@network_bp.route('/api/network/check-status', methods=['POST'])
def api_check_status():
    """
    Receives a list of IPs and checks their online status in a two-step process.
    """
    data = request.get_json() or {}
    ips = data.get("ips", [])
    
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
    logger.info(f"Ping sweep complete. {len(online_by_ping)} hosts online, {len(offline_after_ping)} to check with Port Scan.")

    online_by_ports = set()
    # Step 2: For hosts that failed ping, try a fast TCP Port Scan
    if offline_after_ping:
        logger.info("Starting Phase 2: TCP Port Scan for offline hosts.")
        with ThreadPoolExecutor(max_workers=50, thread_name_prefix="port_scan_worker") as executor:
            future_to_ip = {
                executor.submit(check_host_status_tcp_connect, ip): ip
                for ip in offline_after_ping
            }
            for future in as_completed(future_to_ip):
                ip = future_to_ip[future]
                try:
                    if future.result():
                        online_by_ports.add(ip)
                except Exception:
                    pass
        logger.info(f"Port Scan check complete. Found {len(online_by_ports)} additional hosts online.")
    
    # Step 3: Combine results
    final_online_ips = list(online_by_ping.union(online_by_ports))
    logger.info(f"Total online hosts: {len(final_online_ips)}. Sending response.")
    
    return jsonify({"ok": True, "online_ips": final_online_ips})
    
@network_bp.route('/api/network/check-status-ping', methods=['POST'])
def api_check_status_ping():
    """Checks online status for a list of IPs using only ping."""
    data = request.get_json() or {}
    ips = data.get("ips", [])
    if not ips:
        return jsonify({"ok": True, "online_ips": []})

    logger.info(f"Starting Ping-Only check for {len(ips)} hosts.")
    online_by_ping = set()
    
    with ThreadPoolExecutor(max_workers=50, thread_name_prefix="ping_worker") as executor:
        future_to_ip = {executor.submit(check_host_status_ping, ip): ip for ip in ips}
        for future in as_completed(future_to_ip):
            ip = future_to_ip[future]
            try:
                if future.result():
                    online_by_ping.add(ip)
            except Exception:
                pass
    
    logger.info(f"Ping-Only check complete. Found {len(online_by_ping)} hosts online.")
    return jsonify({"ok": True, "online_ips": list(online_by_ping)})


@network_bp.route('/api/network/check-status-ports', methods=['POST'])
def api_check_status_ports():
    """Checks online status for a list of IPs using only a fast TCP port scan."""
    data = request.get_json() or {}
    ips = data.get("ips", [])
    
    if not ips:
        return jsonify({"ok": True, "online_ips": []})

    logger.info(f"Starting Port-Scan-Only check for {len(ips)} hosts.")
    online_by_ports = set()
    
    with ThreadPoolExecutor(max_workers=50, thread_name_prefix="port_scan_worker") as executor:
        future_to_ip = {
            executor.submit(check_host_status_tcp_connect, ip): ip
            for ip in ips
        }
        for future in as_completed(future_to_ip):
            ip = future_to_ip[future]
            try:
                if future.result():
                    online_by_ports.add(ip)
            except Exception:
                pass

    logger.info(f"Port-Scan-Only check complete. Found {len(online_by_ports)} hosts online.")
    return jsonify({"ok": True, "online_ips": list(online_by_ports)})


@network_bp.route('/api/network/check-winrm', methods=['POST'])
def api_check_winrm():
    """
    Performs a detailed diagnostic check of WinRM on a target host.
    Checks: 1. Service Status (via WMI)
            2. Listener Config (via WinRM)
            3. Firewall Rule (via WinRM)
    """
    data = request.get_json() or {}
    ip = data.get("ip")
    if not ip:
        return jsonify({"ok": False, "error": "IP address is required."}), 400

    user = session.get("user")
    domain = session.get("domain")
    pwd = session.get("password")
    
    if '@' in user:
        winrm_user = user
    else:
        winrm_user = f"{user}@{domain}"
    
    wmi_user = f"{domain}\\{user}"

    # --- Result Structure ---
    results = {
        "service": {"status": "checking", "message": ""},
        "listener": {"status": "checking", "message": ""},
        "firewall": {"status": "checking", "message": ""},
    }
    
    # --- Check 1: Service Status (WMI) ---
    logger.info(f"Checking WinRM service status on {ip} via WMI.")
    try:
        # Import COM libraries here to avoid issues in non-Windows envs if not used
        import win32com.client
        import pythoncom
        pythoncom.CoInitialize() # Initialize COM for the current thread
        wmi_service = win32com.client.Dispatch("WbemScripting.SWbemLocator").ConnectServer(ip, "root\\cimv2", wmi_user, pwd)
        services = wmi_service.ExecQuery("SELECT State, StartMode FROM Win32_Service WHERE Name='WinRM'")
        if len(services) > 0:
            service = list(services)[0]
            if service.State == "Running":
                results["service"] = {"status": "success", "message": f"Service is {service.State} and Start Mode is {service.StartMode}."}
            else:
                results["service"] = {"status": "failure", "message": f"Service is not running. Current state: {service.State}."}
        else:
            results["service"] = {"status": "failure", "message": "WinRM service not found on the target host."}
    except Exception as e:
        error_details = str(e)
        logger.warning(f"WMI check for WinRM service on {ip} failed: {error_details}")
        message = f"WMI/RPC connection failed: {error_details}. Check prerequisites for Remote Registry and firewall (port 135)."
        results["service"] = {"status": "failure", "message": message}
        # If WMI fails, we can't trust the other checks will work, but we try anyway
        # We also pass the error to the other checks as it's the likely root cause
        results["listener"] = {"status": "failure", "message": message}
        results["firewall"] = {"status": "failure", "message": message}
        return jsonify({"ok": True, "results": results}), 200 # Return 200 so UI can parse it
    finally:
        try:
            pythoncom.CoUninitialize()
        except NameError:
            pass
        except Exception:
            pass

    # --- Check 2: Listener (WinRM) ---
    logger.info(f"Checking WinRM listener on {ip} via WinRM.")
    rc_listener, out_listener, err_listener = run_winrm_command(ip, winrm_user, pwd, "winrm enumerate winrm/config/listener", timeout=15)
    if rc_listener == 0 and "Listener" in out_listener:
        results["listener"] = {"status": "success", "message": "WinRM listener is configured and responding."}
    else:
        results["listener"] = {"status": "failure", "message": err_listener or out_listener or "Failed to enumerate WinRM listeners. The service might be stopped or blocked."}

    # --- Check 3: Firewall (WinRM) ---
    # We only run this if the listener check was successful, as it depends on a working WinRM connection
    if results["listener"]["status"] == "success":
        logger.info(f"Checking WinRM firewall rule on {ip} via WinRM.")
        ps_firewall_cmd = "Get-NetFirewallRule -DisplayName 'Windows Remote Management (HTTP-In)' | Where-Object { $_.Enabled -eq 'True' -and $_.Action -eq 'Allow' } | Select-Object -Property Enabled, Action"
        rc_firewall, out_firewall, err_firewall = run_winrm_command(ip, winrm_user, pwd, ps_firewall_cmd, timeout=15)
        if rc_firewall == 0 and out_firewall.strip():
            results["firewall"] = {"status": "success", "message": "Firewall rule 'Windows Remote Management (HTTP-In)' is enabled and allows connections."}
        else:
            results["firewall"] = {"status": "failure", "message": err_firewall or "The 'Windows Remote Management (HTTP-In)' firewall rule is either disabled, not found, or does not allow connections."}
    else:
        # If the listener check failed, the firewall check is also considered failed because it can't be performed.
        results["firewall"] = {"status": "failure", "message": "Cannot check firewall because the WinRM listener is not responding."}

    return jsonify({"ok": True, "results": results})
    
@network_bp.route('/api/network/get-monitoring-data', methods=['POST'])
def get_monitoring_data():
    data = request.get_json() or {}
    force_refresh = data.get('force_refresh', False)

    # 1. Check for cached data
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            last_modified_time = os.path.getmtime(CACHE_FILE)
            if (time.time() - last_modified_time) < CACHE_EXPIRY_SECONDS:
                logger.info("Serving monitoring data from fresh cache.")
                with open(CACHE_FILE, 'r') as f:
                    cached_data = json.load(f)
                return jsonify(cached_data)
        except (IOError, json.JSONDecodeError) as e:
            logger.warning(f"Could not read cache file, forcing refresh. Error: {e}")

    # 2. If no fresh cache, fetch new data
    logger.info("Cache is old or missing, fetching new monitoring data.")
    
    # Get all domain computers
    ad_data_result = _get_ad_computers_data()
    if not ad_data_result.get("ok"):
        return jsonify(ad_data_result), 500
    
    all_ad_computers = ad_data_result.get("computers", [])
    if not all_ad_computers:
        return jsonify({"ok": True, "devices": [], "last_updated": datetime.datetime.utcnow().isoformat()})

    # Check online status for all of them
    ips_to_check = [c['dns_hostname'] for c in all_ad_computers if c.get('dns_hostname')]
    online_ips = set()
    
    logger.info(f"Checking online status for {len(ips_to_check)} AD hosts.")
    with ThreadPoolExecutor(max_workers=50) as executor:
        # Use a combination of ping and TCP connect for robustness
        future_to_ip = {executor.submit(check_host_status_ping, ip): ip for ip in ips_to_check}
        future_to_ip.update({executor.submit(check_host_status_tcp_connect, ip): ip for ip in ips_to_check})

        for future in as_completed(future_to_ip):
            ip = future_to_ip[future]
            try:
                if future.result():
                    online_ips.add(ip)
            except Exception:
                pass # Ignore errors in status checking
    logger.info(f"Found {len(online_ips)} AD hosts online.")

    # Prepare list of devices for performance data fetching
    online_devices_to_poll = [c for c in all_ad_computers if c.get('dns_hostname') in online_ips]

    # Function to fetch performance for a single device
    def fetch_perf_for_device(computer):
        user = session.get("user")
        domain = session.get("domain")
        pwd = session.get("password")
        winrm_user = f"{user}@{domain}" if '@' not in user else user
        
        ip = computer.get('dns_hostname')
        if not ip:
            return {**computer, 'status': 'offline', 'performance': None, 'isFetching': False}
        
        # PowerShell script to gather all data in one go
        ps_script = r"""
            $os = Get-CimInstance -ClassName Win32_OperatingSystem
            $cs = Get-CimInstance -ClassName Win32_ComputerSystem
            $cpu_usage = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1).CounterSamples.CookedValue
            $used_memory = $os.TotalVisibleMemorySize - $os.FreePhysicalMemory
            $disks = Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' } | ForEach-Object {
                [pscustomobject]@{
                    volume = $_.DriveLetter;
                    sizeGB = [math]::Round($_.Size / 1GB, 2);
                    freeGB = [math]::Round($_.SizeRemaining / 1GB, 2);
                }
            }
            @{
                cpuUsage = $cpu_usage;
                totalMemoryGB = [math]::Round($os.TotalVisibleMemorySize / 1KB / 1MB, 2);
                usedMemoryGB = [math]::Round($used_memory / 1KB / 1MB, 2);
                diskInfo = $disks | ConvertTo-Json -Compress
            } | ConvertTo-Json -Compress
        """
        rc, out, err = run_winrm_command(ip, winrm_user, pwd, ps_script)

        performance_data = None
        if rc == 0 and out:
            try:
                raw_data = json.loads(out)
                # diskInfo is a JSON string itself, so we parse it again
                disk_info_raw = raw_data.get('diskInfo')
                if disk_info_raw:
                    raw_data['diskInfo'] = json.loads(disk_info_raw)
                    # Ensure diskInfo is always a list
                    if isinstance(raw_data['diskInfo'], dict):
                        raw_data['diskInfo'] = [raw_data['diskInfo']]
                else:
                    raw_data['diskInfo'] = []
                performance_data = raw_data
            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"Failed to parse performance JSON for {ip}: {e}. Raw: {out}")

        return {
            'id': computer['dn'],
            'name': computer['name'],
            'ipAddress': ip,
            'status': 'online',
            'isFetching': False,
            'performance': performance_data
        }

    # Concurrently fetch performance data for online devices
    final_devices = []
    with ThreadPoolExecutor(max_workers=20) as executor:
        future_to_computer = {executor.submit(fetch_perf_for_device, c): c for c in online_devices_to_poll}
        for future in as_completed(future_to_computer):
            try:
                final_devices.append(future.result())
            except Exception as e:
                 logger.error(f"Error fetching performance data in thread: {e}")

    # Add offline devices to the final list
    offline_computers = [c for c in all_ad_computers if c.get('dns_hostname') not in online_ips]
    for c in offline_computers:
        final_devices.append({
            'id': c['dn'],
            'name': c['name'],
            'ipAddress': c.get('dns_hostname'),
            'status': 'offline',
            'isFetching': False,
            'performance': None
        })

    # Sort the final list for consistent display
    final_devices.sort(key=lambda x: (x['status'] != 'online', x['name']))

    # 3. Write new data to cache
    response_data = {
        "ok": True,
        "devices": final_devices,
        "last_updated": datetime.datetime.utcnow().isoformat()
    }
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(response_data, f)
        logger.info("Successfully updated monitoring cache file.")
    except IOError as e:
        logger.error(f"Failed to write to cache file: {e}")

    return jsonify(response_data)
    
    


