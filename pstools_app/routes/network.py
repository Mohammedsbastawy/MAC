# كود فحص الشبكة (ARP Scan, Ping Sweep, ...)
import os
import ipaddress
import socket
import threading
from flask import Blueprint, request, jsonify, session
from concurrent.futures import ThreadPoolExecutor, as_completed
from pstools_app.utils.helpers import is_valid_ip, get_pstools_path

network_bp = Blueprint('network', __name__)

def get_local_cidr():
    try:
        hostname = socket.gethostname()
        local_ip = socket.gethostbyname(hostname)
        # استخدم /24 تلقائيًا بناءً على الشبكة الفعلية
        return f"{local_ip.rsplit('.', 1)[0]}.0/24"
    except Exception:
        return "192.168.1.0/24"

DEFAULT_SCAN_CIDR = os.environ.get("SCAN_CIDR", get_local_cidr())
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

@network_bp.route('/api/arp-scan', methods=['POST'])
def api_arp_scan():
    import concurrent.futures
    devices = {}
    try:
        net = ipaddress.ip_network(DEFAULT_SCAN_CIDR, strict=False)
        with arp_scan_lock:
            arp_scan_status["running"] = True
            arp_scan_status["devices"] = []
            arp_scan_status["count"] = 0
            arp_scan_status["error"] = None
        def ping(ip):
            import os
            result = os.system(f"ping -n 1 -w 200 {ip} >nul 2>&1")
            if result == 0:
                try:
                    hostname = socket.gethostbyaddr(str(ip))[0]
                except:
                    hostname = "Unknown"
                return {"ip": str(ip), "mac": "-", "hostname": hostname}
            return None
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            futures = {executor.submit(ping, ip): ip for ip in net.hosts()}
            for f in concurrent.futures.as_completed(futures):
                with arp_scan_lock:
                    if not arp_scan_status["running"]:
                        arp_scan_status["error"] = arp_scan_status["error"] or "تم إيقاف الفحص من قبل المستخدم."
                        break
                res = f.result()
                if res:
                    devices[res["ip"]] = res
                    with arp_scan_lock:
                        if not any(d["ip"] == res["ip"] for d in arp_scan_status["devices"]):
                            arp_scan_status["devices"].append(res)
                            arp_scan_status["count"] = len(arp_scan_status["devices"])
        try:
            from scapy.all import ARP, Ether, srp
            import socket as pysocket
            ip_range = str(net)
            ether = Ether(dst="ff:ff:ff:ff:ff:ff")
            arp = ARP(pdst=ip_range)
            ans, _ = srp(ether/arp, timeout=2, verbose=0)
            for snd, rcv in ans:
                ip = rcv.psrc
                mac = rcv.hwsrc
                try:
                    hostname = pysocket.gethostbyaddr(ip)[0]
                except:
                    hostname = "Unknown"
                if ip not in devices:
                    devices[ip] = {"ip": ip, "mac": mac, "hostname": hostname}
                    with arp_scan_lock:
                        if not any(d["ip"] == ip for d in arp_scan_status["devices"]):
                            arp_scan_status["devices"].append({"ip": ip, "mac": mac, "hostname": hostname})
                            arp_scan_status["count"] = len(arp_scan_status["devices"])
        except Exception:
            pass
        with arp_scan_lock:
            arp_scan_status["running"] = False
        return jsonify({"ok": True, "devices": list(devices.values())})
    except Exception as e:
        with arp_scan_lock:
            arp_scan_status["running"] = False
            arp_scan_status["error"] = str(e)
        return jsonify({"ok": False, "error": str(e), "devices": []})

@network_bp.route('/api/scan', methods=['POST'])
def api_scan():
    hosts = []
    try:
        net = ipaddress.ip_network(DEFAULT_SCAN_CIDR, strict=False)
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
