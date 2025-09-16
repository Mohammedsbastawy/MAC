# PowerShell Script to Install and Configure SNMP Service
# This script is intended to be run remotely via PsExec.

# --- Configuration ---
$CommunityString = "public"
# The trap destination IP is passed via an environment variable from the backend.
# Default to localhost if the variable is not set.
$TrapDestination = if ($env:ATLAS_SERVER_IP) { $env:ATLAS_SERVER_IP } else { "127.0.0.1" }

# --- Script Body ---
try {
    # Step 1: Install SNMP Service if not installed
    $snmpFeature = Get-WindowsFeature -Name SNMP-Service -ErrorAction SilentlyContinue
    if (-not $snmpFeature.Installed) {
        Write-Host "SNMP-Service feature not found. Installing..."
        Install-WindowsFeature -Name SNMP-Service -IncludeManagementTools
        Write-Host "SNMP-Service feature installed."
    } else {
        Write-Host "SNMP-Service feature is already installed."
    }

    # Step 2: Configure SNMP Service
    # Set the community string with ReadOnly access
    Set-Service -Name "SNMP" -StartupType Automatic
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\ValidCommunities" -Name $CommunityString -Value 4
    
    # Set the permitted managers (localhost is usually default, we add our server)
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\PermittedManagers" -Name "1" -Value "localhost"
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\PermittedManagers" -Name "2" -Value $TrapDestination

    # Step 3: Configure Trap Destination
    $trapKey = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"
    if (-not (Test-Path -Path $trapKey)) {
        New-Item -Path $trapKey -Force
    }
    Set-ItemProperty -Path $trapKey -Name "1" -Value $TrapDestination
    
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

} catch {
    # Output error for debugging
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}

exit 0
