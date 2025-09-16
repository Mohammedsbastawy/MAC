# PowerShell Script to Install and Configure SNMP Service
# Universal version for both Windows Client (10/11) and Server (2016+)
# This script is intended to be run remotely via PsExec.

# --- Configuration ---
$CommunityString = "public"
# This placeholder will be replaced by the Python backend.
$TrapDestination = "$env:ATLAS_SERVER_IP"

# --- Script Body ---
try {
    # Step 1: Install SNMP Service using the modern, universal capability command
    $snmpCapability = Get-WindowsCapability -Online -Name "SNMP.Client~~~~0.0.1.0"
    if ($snmpCapability.State -ne 'Installed') {
        Write-Host "SNMP feature not found. Installing..."
        Add-WindowsCapability -Online -Name "SNMP.Client~~~~0.0.1.0"
        Write-Host "SNMP feature installed via Add-WindowsCapability."
    } else {
        Write-Host "SNMP feature is already installed."
    }

    # Step 2: Configure SNMP Service Registry Keys
    Set-Service -Name "SNMP" -StartupType Automatic
    
    # Set the community string with ReadOnly access (Value 4)
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\ValidCommunities"
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force }
    Set-ItemProperty -Path $regPath -Name $CommunityString -Value 4 -Type DWord -Force

    # Set the permitted managers (localhost and our server)
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\PermittedManagers"
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force }
    Set-ItemProperty -Path $regPath -Name "1" -Value "localhost" -Type String -Force
    Set-ItemProperty -Path $regPath -Name "2" -Value $TrapDestination -Type String -Force

    # Step 3: Configure Trap Destination
    $trapKey = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"
    if (-not (Test-Path -Path $trapKey)) {
        New-Item -Path $trapKey -Force
    }
    Set-ItemProperty -Path $trapKey -Name "1" -Value $TrapDestination -Type String -Force
    
    Write-Host "SNMP service configured to send traps to $TrapDestination with community '$CommunityString'."

    # Step 4: Configure Windows Firewall
    $ruleName = "SNMP Service (UDP-In)"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $firewallRule) {
        Write-Host "Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol UDP -LocalPort 161, 162 -Action Allow -Profile Any
    } else {
        Write-Host "Firewall rule '$ruleName' already exists. Ensuring it is enabled."
        Enable-NetFirewallRule -DisplayName $ruleName
    }

    # Step 5: Restart the SNMP Service to apply changes
    Write-Host "Restarting SNMP Service to apply all changes..."
    Restart-Service -Name "SNMP" -Force

    Write-Host "SNMP configuration completed successfully."
    exit 0

} catch {
    # Output error for debugging
    $errorMessage = "An error occurred during SNMP configuration: $($_.Exception.Message)"
    Write-Error $errorMessage
    exit 1
}
