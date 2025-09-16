# PowerShell Script to Configure (not install) SNMP Service
# This script is intended to be run remotely via PsExec.
# It assumes the SNMP Service Windows Feature/Capability is already installed.

param(
    [string]$CommunityString = "public",
    [string]$TrapDestination = "127.0.0.1"
)

try {
    Write-Host "Starting SNMP configuration..."

    # Step 1: Ensure SNMP Service is running and set to Automatic
    try {
        Set-Service -Name "SNMP" -StartupType Automatic -ErrorAction Stop
        Start-Service -Name "SNMP" -ErrorAction SilentlyContinue # Start if not already running
        Write-Host "SNMP service is running and set to automatic."
    } catch {
        Write-Error "Failed to set or start SNMP Service. Ensure the 'SNMP Service' feature is installed on the target machine. Error: $_"
        exit 1
    }

    # Step 2: Configure Registry for Community String and Trap Destination
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters"
    
    # Community String (Value 4 means ReadOnly)
    $validCommunitiesPath = Join-Path -Path $regPath -ChildPath "ValidCommunities"
    if (!(Test-Path $validCommunitiesPath)) { New-Item -Path $validCommunitiesPath -Force }
    Set-ItemProperty -Path $validCommunitiesPath -Name $CommunityString -Value 4 -Type DWord -Force
    Write-Host "Set community string '$CommunityString'."

    # Trap Destination
    $trapConfigPath = Join-Path -Path $regPath -ChildPath "TrapConfiguration\$CommunityString"
    if (!(Test-Path $trapConfigPath)) { New-Item -Path $trapConfigPath -Force }
    Set-ItemProperty -Path $trapConfigPath -Name "1" -Value $TrapDestination -Type String -Force
    Write-Host "Set trap destination to '$TrapDestination'."

    # Step 3: Ensure Firewall allows SNMP traffic
    $ruleName = "SNMP"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $firewallRule) {
        Write-Host "Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol UDP -LocalPort 161 -Action Allow -Profile Any -ErrorAction Stop
    } else {
        Write-Host "Firewall rule '$ruleName' already exists. Ensuring it is enabled."
        Enable-NetFirewallRule -DisplayName $ruleName -ErrorAction Stop
    }
    
    # The Trap service rule
    $trapRuleName = "SNMPTRAP"
     $trapFirewallRule = Get-NetFirewallRule -DisplayName $trapRuleName -ErrorAction SilentlyContinue
    if (-not $trapFirewallRule) {
        Write-Host "Firewall rule '$trapRuleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $trapRuleName -Direction Inbound -Protocol UDP -LocalPort 162 -Action Allow -Profile Any -ErrorAction Stop
    } else {
        Write-Host "Firewall rule '$trapRuleName' already exists. Ensuring it is enabled."
        Enable-NetFirewallRule -DisplayName $trapRuleName -ErrorAction Stop
    }

    # Step 4: Restart the SNMP Service to apply all registry changes
    Write-Host "Restarting SNMP Service..."
    Restart-Service -Name "SNMP" -Force

    # Step 5: Send a test trap to confirm connectivity
    # This requires the 'trapgen.exe' utility, which should be available with SNMP.
    try {
        Write-Host "Sending a test trap to $TrapDestination..."
        # Generic trap, enterprise OID, generic trap ID 6 (enterpriseSpecific), specific trap ID 1
        trapgen -d $TrapDestination -c $CommunityString -g 6 -s 1 1.3.6.1.4.1.9999.1.0 ""
        Write-Host "Test trap sent."
    } catch {
        Write-Warning "Could not send a test trap using 'trapgen.exe'. The utility might not be in the system's PATH. However, configuration may still be successful."
    }

    Write-Host "SNMP configuration completed successfully."

} catch {
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}

exit 0

    