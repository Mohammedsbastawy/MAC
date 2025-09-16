# PowerShell Script to Install and Configure SNMP Service
# This script is universal and works on both Windows Client and Server editions.

# --- Configuration ---
$CommunityString = "public"
$TrapDestination = "$SERVER_IP_PLACEHOLDER$" # This will be replaced by the Python backend.

# --- Script Body ---
try {
    # Step 1: Install SNMP Service if not installed
    # This command works for both Windows 10/11 and Windows Server
    $snmpCapability = Get-WindowsCapability -Online -Name "SNMP.Client~~~~0.0.1.0"
    if ($snmpCapability.State -ne 'Installed') {
        Write-Host "SNMP capability not found. Installing..."
        Add-WindowsCapability -Online -Name "SNMP.Client~~~~0.0.1.0"
        Write-Host "SNMP capability installed."
    } else {
        Write-Host "SNMP capability is already installed."
    }

    # Step 2: Ensure SNMP services are configured to start automatically
    Write-Host "Configuring SNMP services..."
    Set-Service -Name "SNMP" -StartupType Automatic
    Set-Service -Name "SNMPTRAP" -StartupType Automatic

    # Step 3: Configure Registry for Trap Destination
    Write-Host "Configuring registry for trap destination..."
    $trapKey = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"
    
    if (-not (Test-Path -Path $trapKey)) {
        Write-Host "Creating registry key for trap configuration..."
        New-Item -Path $trapKey -Force
    }
    
    # Set the trap destination IP
    Set-ItemProperty -Path $trapKey -Name "1" -Value $TrapDestination

    # Step 4: Configure Firewall
    Write-Host "Configuring outbound firewall rule for SNMP traps..."
    $ruleName = "Allow SNMP Trap Out"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    
    if (-not $firewallRule) {
        Write-Host "Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Protocol UDP -RemotePort 162 -Action Allow
    } else {
        Write-Host "Firewall rule '$ruleName' already exists. Ensuring it is enabled."
        Enable-NetFirewallRule -DisplayName $ruleName
    }

    # Step 5: Restart the SNMP Service to apply all changes
    Write-Host "Restarting SNMP Service to apply all changes..."
    Restart-Service -Name "SNMP" -Force

    Write-Host "SNMP configuration completed successfully."

} catch {
    # Output error for debugging
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}

exit 0
