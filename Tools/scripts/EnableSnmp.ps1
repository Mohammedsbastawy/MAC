
# PowerShell Script to Install and Configure SNMP Service (Universal)
# This script is intended to be run remotely via PsExec and works on both Client and Server OS.

# --- Configuration ---
$CommunityString = "public"
# The trap destination IP is passed via an environment variable from the backend.
# Default to localhost if the variable is not set.
$TrapDestination = if ($env:ATLAS_SERVER_IP) { $env:ATLAS_SERVER_IP } else { "127.0.0.1" }

# --- Script Body ---
try {
    # Step 1: Install SNMP Service if not installed (Universal Method)
    $snmpCapability = Get-WindowsCapability -Name "SNMP.Client~~~~0.0.1.0" -Online -ErrorAction SilentlyContinue

    if ($snmpCapability) {
        # --- Client OS Logic (Windows 10/11) ---
        if ($snmpCapability.State -ne "Installed") {
            Write-Host "SNMP feature not found on Client OS. Installing via Add-WindowsCapability..."
            Add-WindowsCapability -Name "SNMP.Client~~~~0.0.1.0" -Online
            Write-Host "SNMP feature installed."
        } else {
            Write-Host "SNMP feature is already installed on this Client OS."
        }
    } else {
        # --- Server OS Logic ---
        $snmpFeature = Get-WindowsFeature -Name SNMP-Service -ErrorAction SilentlyContinue
        if ($snmpFeature -and (-not $snmpFeature.Installed)) {
            Write-Host "SNMP feature not found on Server OS. Installing via Install-WindowsFeature..."
            Install-WindowsFeature -Name SNMP-Service
            Write-Host "SNMP feature installed."
        } else {
             Write-Host "SNMP feature is already installed on this Server OS."
        }
    }

    # Step 2: Configure SNMP Service
    # Set the community string with ReadOnly access (Value 4)
    Write-Host "Configuring SNMP registry settings..."
    Set-Service -Name "SNMP" -StartupType Automatic
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\ValidCommunities"
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force }
    Set-ItemProperty -Path $regPath -Name $CommunityString -Value 4 -Type DWord -Force
    
    # Set the permitted managers
    $managersPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\PermittedManagers"
    if (-not (Test-Path $managersPath)) { New-Item -Path $managersPath -Force }
    Set-ItemProperty -Path $managersPath -Name "1" -Value "localhost" -Force
    Set-ItemProperty -Path $managersPath -Name "2" -Value $TrapDestination -Force

    # Step 3: Configure Trap Destination
    $trapKey = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"
    if (-not (Test-Path -Path $trapKey)) {
        New-Item -Path $trapKey -Force
    }
    Set-ItemProperty -Path $trapKey -Name "1" -Value $TrapDestination -Force
    
    Write-Host "SNMP service configured to send traps to $TrapDestination."

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
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}

    