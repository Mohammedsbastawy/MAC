# PowerShell Script to Install and Configure SNMP Service
# This script is intended to be run remotely via PsExec.
$ErrorActionPreference = "Stop"

# --- Configuration ---
$CommunityString = "public"
# The trap destination IP is replaced by the Python backend before execution.
$TrapDestination = "$SERVER_IP_PLACEHOLDER$"

# --- Script Body ---
try {
    Write-Host "Starting SNMP configuration..."

    # Step 1: Install SNMP Service if not installed. This is for Windows Client OS.
    try {
        $capability = Get-WindowsCapability -Online -Name "SNMP.Client*" | Where-Object { $_.Name -like "SNMP.Client*" }
        if ($capability.State -ne "Installed") {
            Write-Host "SNMP feature not found on client OS. Installing..."
            Add-WindowsCapability -Online -Name $capability.Name
            Write-Host "SNMP feature installed."
        } else {
            Write-Host "SNMP feature already installed on client OS."
        }
    } catch {
        # This will fail on Server OS, which is expected. We try the server command instead.
        Write-Warning "Could not use Get-WindowsCapability (expected on Server OS). Trying Get-WindowsFeature..."
        try {
            $snmpFeature = Get-WindowsFeature -Name SNMP-Service
            if (-not $snmpFeature.Installed) {
                Write-Host "SNMP-Service feature not found on Server OS. Installing..."
                Install-WindowsFeature -Name SNMP-Service -IncludeManagementTools
                Write-Host "SNMP-Service feature installed."
            } else {
                Write-Host "SNMP-Service feature is already installed on Server OS."
            }
        } catch {
             throw "Failed to install SNMP using both client and server methods. Please install it manually."
        }
    }

    # Step 2: Configure SNMP Service
    Write-Host "Setting community string '$CommunityString'."
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\ValidCommunities" -Name $CommunityString -Value 4 -Force
    
    Write-Host "Setting trap destination to '$TrapDestination'."
    $trapKey = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"
    if (-not (Test-Path -Path $trapKey)) {
        New-Item -Path $trapKey -Force
    }
    Set-ItemProperty -Path $trapKey -Name "1" -Value $TrapDestination -Force

    # Step 3: Configure Firewall
    $ruleName = "SNMP Service"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $firewallRule) {
        Write-Host "Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol UDP -LocalPort 161 -Action Allow -Profile Any
    } else {
        Write-Host "Firewall rule '$ruleName' already exists. Ensuring it is enabled."
        Enable-NetFirewallRule -DisplayName $ruleName
    }
    
    $trapRuleName = "SNMPTRAP"
    $trapFirewallRule = Get-NetFirewallRule -DisplayName $trapRuleName -ErrorAction SilentlyContinue
    if (-not $trapFirewallRule) {
        Write-Host "Firewall rule '$trapRuleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $trapRuleName -Direction Inbound -Protocol UDP -LocalPort 162 -Action Allow -Profile Any
    } else {
        Write-Host "Firewall rule '$trapRuleName' already exists. Ensuring it is enabled."
        Enable-NetFirewallRule -DisplayName $trapRuleName
    }

    # Step 4: Ensure services are running and set to automatic
    Write-Host "Ensuring SNMP services are running and set to automatic."
    Set-Service -Name "SNMP" -StartupType Automatic
    Start-Service -Name "SNMP"
    Set-Service -Name "SNMPTrap" -StartupType Automatic
    Start-Service -Name "SNMPTrap"

    # Step 5: Restart the SNMP Service to apply changes and send a coldStart trap
    Write-Host "Restarting SNMP Service to apply all changes and send a confirmation trap..."
    Restart-Service -Name "SNMP" -Force

    Write-Host "SNMP configuration completed successfully."
} catch {
    # Output error for debugging
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}

exit 0
