# كود فحص الشبكة (ARP Scan, Ping Sweep, ...)
import os
import ipaddress
import socket
import threading
import re
from flask import Blueprint, request, jsonify, session
from concurrent.futures import ThreadPoolExecutor, as_completed
from pstools_app.utils.helpers import is_valid_ip, get_pstools_path, run_ps_command, parse_psinfo_output

try:
    from scapy.all import get_if_list, get_if_addr, get_if_hwaddr, conf, srp, Ether, ARP
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False


network_bp = Blueprint('network', __name__)

def get_local_cidr():
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        # استخدم /24 تلقائيًا بناءً على الشبكة الفعلية
        return f"{local_ip.rsplit('.', 1)[0]}.0/24"
    except Exception:
        return "192.168.1.0/24"

DEFAULT_SCAN_CIDR = get_local_cidr()
arp_scan_status = {"running": False, "count": 0, "devices": [], "error": None}
arp_scan_lock = threading.Lock()

def login_required_api():
    if 'user' not in session or 'email' not in session:
        return jsonify({'ok': False, 'error': 'يجب تسجيل الدخول أولاً'}), 401

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
        # Scapy can be unreliable, so we build a primary list and a fallback
        if SCAPY_AVAILABLE:
            for iface_name in get_if_list():
                iface = conf.ifaces.get(iface_name)
                # Check for valid IP and netmask, ignore loopback
                if iface and hasattr(iface, 'ip') and hasattr(iface, 'netmask') and iface.ip and iface.netmask and iface.ip != '127.0.0.1':
                    try:
                        net = ipaddress.ip_network(f"{iface.ip}/{iface.netmask}", strict=False)
                        interfaces_list.append({
                            "id": iface.guid if hasattr(iface, 'guid') and iface.guid is not None and iface.guid != '' else iface_name,
                            "name": iface.name or f"Interface ({iface.ip})",
                            "ip": iface.ip,
                            "netmask": iface.netmask,
                            "cidr": str(net.with_prefixlen)
                        })
                    except (ValueError, TypeError):
                        # Skip if IP/Netmask is invalid for ipaddress library
                        continue

        # If scapy fails or finds nothing, use a more reliable fallback
        if not interfaces_list:
            hostname = socket.gethostname()
            # This gets all IPs associated with the host, including VPNs
            all_ips = socket.getaddrinfo(hostname, None)
            
            for res in all_ips:
                family, socktype, proto, canonname, sockaddr = res
                ip_addr = sockaddr[0]
                # Filter for IPv4 and non-loopback
                if family == socket.AF_INET and not ip_addr.startswith('127.'):
                    # Create a plausible CIDR, usually /24 for local networks
                    cidr = f"{ip_addr.rsplit('.', 1)[0]}.0/24"
                    # Avoid adding duplicates
                    if not any(d['ip'] == ip_addr for d in interfaces_list):
                        interfaces_list.append({
                            "id": f"fallback_{ip_addr}",
                            "name": f"Network ({ip_addr})",
                            "ip": ip_addr,
                            "netmask": "255.255.255.0", # Assumption
                            "cidr": cidr
                        })
            
        return jsonify({"ok": True, "interfaces": interfaces_list})
    except Exception as e:
        # Ensure some response is always sent on error
        return jsonify({"ok": False, "error": f"An unexpected error occurred while fetching interfaces: {str(e)}"}), 500


@network_bp.route('/api/arp-scan-status', methods=['POST'])
def api_arp_scan_status():
    with arp_scan_lock:
        return jsonify({
            "ok": True,
            "running": arp_scan_status["running"],
            "count": arp_scan_status["count"],
            "devices": list(arp_scan_status["devices"]),
            "error": arp_scan_status["error"]
        })

@network_bp.route('/api/arp-scan-cancel', methods=['POST'])
def api_arp_scan_cancel():
    with arp_scan_lock:
        arp_scan_status["running"] = False
        arp_scan_status["error"] = "تم إيقاف الفحص من قبل المستخدم."
    return jsonify({"ok": True, "message": "ARP scan cancelled."})

def get_device_details(ip, email, pwd, user_domain):
    """
    Fetches detailed information for a single device using PsInfo.
    """
    device_details = { "domain": "WORKGROUP", "isDomainMember": False, "os": "Unknown" }
    
    try:
        rc, out, err = run_ps_command("psinfo", ip, email, pwd, ["-d"])
        if rc == 0 and out:
            # Parse psinfo output
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

    except Exception:
        # Ignore errors for single devices to not fail the whole scan
        pass

    return device_details

@network_bp.route('/api/arp-scan', methods=['POST'])
def api_arp_scan():
    import concurrent.futures
    data = request.get_json() or {}
    scan_cidr = data.get("cidr", DEFAULT_SCAN_CIDR)
    user_domain = session.get("domain") # Get domain from session
    email = session.get("email")
    pwd = session.get("password")

    devices = {}
    try:
        net = ipaddress.ip_network(scan_cidr, strict=False)
        with arp_scan_lock:
            arp_scan_status["running"] = True
            arp_scan_status["devices"] = []
            arp_scan_status["count"] = 0
            arp_scan_status["error"] = None

        def ping_and_detail(ip):
            # 1. Ping the device
            result = os.system(f"ping -n 1 -w 200 {ip} >nul 2>&1")
            if result == 0:
                # 2. Get base info
                try:
                    hostname = socket.gethostbyaddr(str(ip))[0]
                except:
                    hostname = "Unknown"
                base_device = {"ip": str(ip), "mac": "-", "hostname": hostname}
                
                # 3. Get domain details
                details = get_device_details(str(ip), email, pwd, user_domain)
                base_device.update(details)
                return base_device
            return None

        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            futures = {executor.submit(ping_and_detail, ip): ip for ip in net.hosts()}
            for f in concurrent.futures.as_completed(futures):
                with arp_scan_lock:
                    if not arp_scan_status["running"]:
                        arp_scan_status["error"] = arp_scan_status["error"] or "تم إيقاف الفحص من قبل المستخدم."
                        break
                res = f.result()
                if res:
                    devices[res["ip"]] = res
                    with arp_scan_lock:
                        # Avoid duplicates
                        arp_device_list = arp_scan_status["devices"]
                        if not any(d["ip"] == res["ip"] for d in arp_device_list):
                            arp_device_list.append(res)
                            arp_scan_status["count"] = len(arp_device_list)
        
        # Scapy as a secondary method to find MACs
        if SCAPY_AVAILABLE:
            try:
                ether = Ether(dst="ff:ff:ff:ff:ff:ff")
                arp = ARP(pdst=str(net))
                ans, _ = srp(ether/arp, timeout=2, verbose=0)
                for snd, rcv in ans:
                    ip = rcv.psrc
                    mac = rcv.hwsrc
                    if ip in devices:
                        devices[ip]['mac'] = mac # Update MAC address
                    else: # If scapy finds a device ping missed
                        try:
                            hostname = socket.gethostbyaddr(ip)[0]
                        except:
                            hostname = "Unknown"
                        
                        base_device = {"ip": str(ip), "mac": mac, "hostname": hostname}
                        details = get_device_details(ip, email, pwd, user_domain)
                        base_device.update(details)
                        devices[ip] = base_device

            except Exception:
                pass # Scapy might fail on some systems, ping sweep is a good fallback
        
        with arp_scan_lock:
            arp_scan_status["running"] = False
            # Final sort of devices and update the status list
            sorted_devices = sorted(list(devices.values()), key=lambda x: ipaddress.ip_address(x['ip']))
            arp_scan_status["devices"] = sorted_devices

        return jsonify({"ok": True, "devices": arp_scan_status["devices"]})
    except Exception as e:
        with arp_scan_lock:
            arp_scan_status["running"] = False
            arp_scan_status["error"] = str(e)
        return jsonify({"ok": False, "error": str(e), "devices": []})

@network_bp.route('/api/devices', methods=['POST'])
def api_devices():
    """Returns the currently cached list of devices without starting a new scan."""
    with arp_scan_lock:
        return jsonify({
            "ok": True,
            "devices": list(arp_scan_status["devices"]),
        })

@network_bp.route('/api/scan', methods=['POST'])
def api_scan():
    data = request.get_json() or {}
    scan_cidr = data.get("cidr", DEFAULT_SCAN_CIDR)

    hosts = []
    try:
        net = ipaddress.ip_network(scan_cidr, strict=False)
        ip_list = [str(ip) for ip in net.hosts()]
        def ping_ip(ip_str):
            rc = os.system(f"ping -n 1 -w 200 {ip_str} >nul 2>&1")
            return ip_str if rc == 0 else None
        with ThreadPoolExecutor(max_workers=32) as executor:
            futures = {executor.submit(ping_ip, ip): ip for ip in ip_list}
            for future in as_completed(futures):
                result = future.result()
                if result:
                    hosts.append(result)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e), "hosts": []})
    return jsonify({"ok": True, "hosts": hosts})

    

