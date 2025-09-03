# دوال مساعدة عامة (مثلاً: قراءة config، فحص IP، ...)
import os
import ipaddress

def is_valid_ip(ip: str) -> bool:
    try:
        ipaddress.ip_address(ip)
        return True
    except Exception:
        return False

def get_pstools_path(exe_name: str) -> str:
    """
    Constructs the full path to a PsTools executable.
    It assumes the executables are in the 'pstools_app' directory.
    """
    # __file__ is helpers.py -> dirname is utils -> dirname is pstools_app
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidate = os.path.join(base_dir, exe_name)
    
    # Return the full path if the file exists, otherwise return just the name
    # so the system can try to find it in the PATH.
    return candidate if os.path.isfile(candidate) else exe_name

# ... دوال أخرى حسب الحاجة ...
