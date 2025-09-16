# PowerShell Script to Configure SNMP Service
# This script is intended to be run remotely via PsExec.

# --- Configuration ---
param(
    [string]$TrapDestination = "127.0.0.1"
)
$CommunityString = "public"

# --- Script Body ---
try {
    $ErrorActionPreference = "Stop"
    
    # Step 1: Ensure SNMP Service and Trap service are installed and running
    Write-Host "Step 1: Checking for SNMP Service..."
    $snmpService = Get-Service -Name "SNMP" -ErrorAction SilentlyContinue
    if (!$snmpService) {
        throw "SNMP Service is not installed. Please install it via 'Windows Features' on the target machine before running this script."
    }
    Write-Host "SNMP Service is installed."
    
    Write-Host "Ensuring SNMP Service is set to Automatic and started..."
    Set-Service -Name "SNMP" -StartupType Automatic
    Start-Service -Name "SNMP"
    
    Write-Host "Ensuring SNMP Trap Service is set to Automatic and started..."
    Set-Service -Name "SNMPTrap" -StartupType Automatic
    Start-Service -Name "SNMPTrap"
    Write-Host "Services are configured and running."
    
    # Step 2: Configure SNMP Service Registry
    Write-Host "Step 2: Configuring SNMP registry settings..."
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters"
    
    # Set Community String
    $communityPath = Join-Path -Path $regPath -ChildPath "ValidCommunities"
    if (!(Test-Path $communityPath)) { New-Item -Path $communityPath -Force | Out-Null }
    Set-ItemProperty -Path $communityPath -Name $CommunityString -Value 4 # 4 = ReadOnly
    Write-Host " - Community string '$CommunityString' set to ReadOnly."

    # Set Trap Destination
    $trapConfigPath = Join-Path -Path $regPath -ChildPath "TrapConfiguration\$CommunityString"
    if (!(Test-Path $trapConfigPath)) { New-Item -Path $trapConfigPath -Force | Out-Null }
    Set-ItemProperty -Path $trapConfigPath -Name "1" -Value $TrapDestination
    Write-Host " - Trap destination set to '$TrapDestination'."

    # Step 3: Configure Windows Firewall
    Write-Host "Step 3: Configuring Windows Firewall..."
    $ruleName = "SNMP Traps (UDP-Out)"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    
    if (!$firewallRule) {
        Write-Host " - Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Protocol UDP -RemotePort 162 -Action Allow
    } else {
        Write-Host " - Firewall rule '$ruleName' already exists. Ensuring it is enabled."
        Enable-NetFirewallRule -DisplayName $ruleName
    }
    Write-Host "Firewall configured."
    
    # Step 4: Send a test trap
    Write-Host "Step 4: Sending a test trap to confirm configuration..."
    try {
        # Check for trapgen.exe
        $trapgenPath = Join-Path -Path $env:SystemRoot -ChildPath "System32\trapgen.exe"
        if (Test-Path $trapgenPath) {
            trapgen -d $TrapDestination -c $CommunityString -g 6 -s 1 -o 1.3.6.1.4.1 -t 60
            Write-Host " - Test trap sent successfully via trapgen.exe."
        } else {
            Write-Warning " - trapgen.exe not found. Cannot send a test trap. Configuration is likely complete, but cannot be verified automatically."
        }
    } catch {
        Write-Warning " - Could not send a test trap: $($_.Exception.Message)"
    }

    Write-Host "SNMP configuration completed successfully."
    exit 0

} catch {
    # Output error for debugging
    $errorMessage = "An error occurred during SNMP configuration: $($_.Exception.Message)"
    Write-Error $errorMessage
    exit 1
}
