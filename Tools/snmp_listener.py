# SNMP Trap Listener Service using asyncio for modern Python versions
import asyncio
import threading
from pysnmp.carrier.asyncio.dgram import udp
from pysnmp.entity import engine, config
from pysnmp.entity.rfc3413 import ntfrcv
from Tools.utils.logger import logger
from datetime import datetime
import json
import os

# --- In-Memory Storage for Traps ---
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
            logger.info(f"Loaded {len(snmp_traps)} SNMP traps from log file.")
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
        oid_str = name.prettyPrint()
        val_str = val.prettyPrint()
        logger.info(f"{oid_str} = {val_str}")
        trap_data["variables"].append({
            "oid": oid_str,
            "value": val_str
        })

    snmp_traps.insert(0, trap_data)
    if len(snmp_traps) > MAX_TRAPS:
        snmp_traps = snmp_traps[:MAX_TRAPS]
    
    save_traps()

async def start_listener_async():
    """Initializes and starts the SNMP Trap Listener using asyncio."""
    snmpEngine = engine.SnmpEngine()

    trap_port = 162
    
    try:
        loop = asyncio.get_running_loop()
        
        # This is the correct way to start a listening server with asyncio for pysnmp
        transport = udp.UdpAsyncioTransport()
        await loop.create_datagram_endpoint(
            lambda: transport, local_addr=('0.0.0.0', trap_port)
        )

        config.addTransport(snmpEngine, udp.domainName, transport)
        logger.info(f"SNMP Listener: Successfully bound to UDP port {trap_port}")

    except Exception as e:
        logger.error(f"SNMP Listener FATAL: Could not bind to port {trap_port}. "
                     f"Make sure you are running with administrator/root privileges and that no other service is using this port. Error: {e}")
        return

    # Configure community strings
    config.addV1System(snmpEngine, 'public', 'public')
    config.addV1System(snmpEngine, 'private', 'private')

    # Register the callback for receiving traps
    ntfrcv.NotificationReceiver(snmpEngine, trap_callback)

    logger.info(f"SNMP Trap Listener is running and waiting for traps on port {trap_port}...")
    
    # This keeps the listener running indefinitely
    snmpEngine.transportDispatcher.jobStarted(1)
    try:
        await asyncio.Event().wait()
    except asyncio.CancelledError:
        logger.info("SNMP listener task cancelled.")
    finally:
        snmpEngine.transportDispatcher.jobFinished(1)


def run_listener_in_new_loop():
    """Creates and runs a new asyncio event loop."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(start_listener_async())
    except KeyboardInterrupt:
        logger.info("SNMP Listener shutting down.")
    finally:
        loop.close()

def get_current_traps():
    """Returns the list of currently stored traps."""
    return snmp_traps

def run_in_background():
    """Runs the SNMP listener in a separate thread."""
    load_traps()
    listener_thread = threading.Thread(target=run_listener_in_new_loop, daemon=True)
    listener_thread.start()
    logger.info("SNMP Listener has been started in a background thread.")
