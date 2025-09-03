# دوال مساعدة عامة (مثلاً: قراءة config، فحص IP، ...)
def is_valid_ip(ip: str) -> bool:
    import ipaddress
    try:
        ipaddress.ip_address(ip)
        return True
    except Exception:
        return False

# ... دوال أخرى حسب الحاجة ...
