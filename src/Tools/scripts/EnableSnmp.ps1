# PowerShell Script to Configure an EXISTING SNMP Service
# This script assumes the SNMP Service feature is already installed.

# --- Configuration ---
$CommunityString = "public"
# The trap destination IP is replaced by the backend before execution.
$TrapDestination = "$SERVER_IP_PLACEHOLDER$"

# --- Script Body ---
try {
    # Step 1: Ensure SNMP Service is running and set to automatic
    Write-Host "Configuring SNMP Service..."
    Set-Service -Name "SNMP" -StartupType Automatic -ErrorAction Stop
    
    # Step 2: Configure SNMP Community String and Permissions
    # This sets the community string 'public' with ReadOnly access (4).
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\ValidCommunities"
    if (!(Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    Set-ItemProperty -Path $regPath -Name $CommunityString -Value 4 -Type DWord -Force

    # Step 3: Configure Permitted Managers
    # Allow requests from the local machine and our monitoring server.
    $managersPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\PermittedManagers"
     if (!(Test-Path $managersPath)) {
        New-Item -Path $managersPath -Force | Out-Null
    }
    Set-ItemProperty -Path $managersPath -Name "1" -Value "localhost" -Force
    Set-ItemProperty -Path $managersPath -Name "2" -Value $TrapDestination -Force

    # Step 4: Configure Trap Destination
    $trapKey = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"
    if (-not (Test-Path -Path $trapKey)) {
        New-Item -Path $trapKey -Force | Out-Null
    }
    Set-ItemProperty -Path $trapKey -Name "1" -Value $TrapDestination -Force
    Write-Host "SNMP service configured to send traps to $TrapDestination."

    # Step 5: Configure Windows Firewall
    # This rule allows incoming SNMP requests and outgoing traps.
    $ruleName = "SNMP Service (UDP)"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $firewallRule) {
        Write-Host "Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol UDP -LocalPort 161 -Action Allow -Profile Any
        New-NetFirewallRule -DisplayName "$ruleName Traps" -Direction Outbound -Protocol UDP -RemotePort 162 -Action Allow -Profile Any
    } else {
        Write-Host "Firewall rule '$ruleName' already exists. Ensuring it is enabled."
        Enable-NetFirewallRule -DisplayName $ruleName
        Enable-NetFirewallRule -DisplayName "$ruleName Traps"
    }

    # Step 6: Restart the SNMP Service to apply all changes
    Write-Host "Restarting SNMP Service..."
    Restart-Service -Name "SNMP" -Force
    
    Write-Host "SNMP configuration completed successfully."
    exit 0

} catch {
    # Output error for debugging
    $errorMessage = "An error occurred during SNMP configuration: $($_.Exception.Message)"
    Write-Error $errorMessage
    exit 1
}
