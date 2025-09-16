# SNMP Trap Listener Service
import threading
from pysnmp.carrier.asyncore.dgram import udp
from pysnmp.entity import engine, config
from pysnmp.entity.rfc3413 import ntfrcv
from Tools.utils.logger import logger
from datetime import datetime
import json
import os

# --- In-Memory Storage for Traps ---
# In a production app, this would be a database or a message queue.
# For simplicity, we'll store traps in memory and write to a file.
MAX_TRAPS = 200
trap_log_file = os.path.abspath(os.path.join(os.path.dirname(__file__), 'snmp_traps.json'))
snmp_traps = []

def load_traps():
    """Load traps from the log file on startup."""
    global snmp_traps
    if os.path.exists(trap_log_file):
        try:
            with open(trap_log_file, 'r') as f:
                snmp_traps = json.load(f)
        except (IOError, json.JSONDecodeError) as e:
            logger.error(f"Could not load SNMP trap log file: {e}")
            snmp_traps = []

def save_traps():
    """Save the current traps to the log file."""
    try:
        with open(trap_log_file, 'w') as f:
            json.dump(snmp_traps, f, indent=2)
    except IOError as e:
        logger.error(f"Could not save SNMP trap log file: {e}")


def trap_callback(snmpEngine, stateReference, contextEngineId, contextName, varBinds, cbCtx):
    """Callback function to process received traps."""
    global snmp_traps
    
    transportDomain, transportAddress = snmpEngine.msgAndPduDsp.getTransportInfo(stateReference)
    source_ip = transportAddress[0]
    
    logger.info(f"Received SNMP Trap from {source_ip}")

    trap_data = {
        "source": source_ip,
        "timestamp": datetime.utcnow().isoformat(),
        "variables": []
    }

    for name, val in varBinds:
        logger.info(f"{name.prettyPrint()} = {val.prettyPrint()}")
        trap_data["variables"].append({
            "oid": name.prettyPrint(),
            "value": val.prettyPrint()
        })

    # Add to in-memory list and keep it trimmed
    snmp_traps.insert(0, trap_data)
    if len(snmp_traps) > MAX_TRAPS:
        snmp_traps = snmp_traps[:MAX_TRAPS]
    
    # Persist traps to file
    save_traps()


def start_listener():
    """Initializes and starts the SNMP Trap Listener."""
    snmpEngine = engine.SnmpEngine()

    # --- Listener Configuration ---
    # We listen on all interfaces '0.0.0.0' on the standard SNMP trap port 162
    trap_port = 162
    
    try:
        config.addTransport(
            snmpEngine,
            udp.domainName,
            udp.UdpTransport().openServerMode(('0.0.0.0', trap_port))
        )
        logger.info(f"SNMP Listener: Successfully bound to UDP port {trap_port}")
    except Exception as e:
        logger.error(f"SNMP Listener FATAL: Could not bind to port {trap_port}. "
                     f"Make sure you are running with administrator/root privileges and that no other service is using this port. Error: {e}")
        return

    # --- Community Strings ---
    # Configure community strings to accept traps from.
    # We'll accept traps with the "public" and "private" community strings.
    config.addV1System(snmpEngine, 'community-public', 'public')
    config.addV1System(snmpEngine, 'community-private', 'private')

    # Register the callback function for incoming notifications
    ntfrcv.NotificationReceiver(snmpEngine, trap_callback)

    logger.info(f"SNMP Trap Listener is running and waiting for traps on port {trap_port}...")

    try:
        # This starts the I/O dispatcher. It will block until jobFinished() is called.
        snmpEngine.transportDispatcher.jobStarted(1)
        snmpEngine.transportDispatcher.runDispatcher()
    except Exception as e:
        logger.error(f"SNMP Listener dispatcher error: {e}", exc_info=True)
    finally:
        snmpEngine.transportDispatcher.closeDispatcher()
        logger.info("SNMP Trap Listener has stopped.")

def get_current_traps():
    """Returns the list of currently stored traps."""
    return snmp_traps

def run_in_background():
    """Runs the SNMP listener in a separate thread."""
    load_traps() # Load previous traps from file
    listener_thread = threading.Thread(target=start_listener, daemon=True)
    listener_thread.start()
    logger.info("SNMP Listener has been started in a background thread.")
