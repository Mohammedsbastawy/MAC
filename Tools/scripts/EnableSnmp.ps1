# PowerShell Script to Install and Configure SNMP Service
# This script is universal and works on both Windows Client and Server editions.
# It accepts a mandatory parameter for the trap destination.

param(
    [Parameter(Mandatory=$true)]
    [string]$TrapDestination
)

try {
    Write-Host "Step 1: Checking/Installing SNMP Service..." -ForegroundColor Yellow
    
    # Check if SNMP is installed using the modern capability model
    $snmpCapability = Get-WindowsCapability -Online -Name "SNMP.Client*" | Where-Object { $_.Name -like "SNMP.Client*" }
    
    if ($snmpCapability.State -ne 'Installed') {
        Write-Host " - SNMP is not installed. Attempting installation..."
        Add-WindowsCapability -Online -Name $snmpCapability.Name
        Write-Host " - SNMP feature installed successfully." -ForegroundColor Green
    } else {
        Write-Host " - SNMP Service is already installed."
    }

    # Step 2: Configure and Start Services
    Write-Host "Step 2: Configuring and starting services..." -ForegroundColor Yellow
    Set-Service -Name "SNMP" -StartupType Automatic
    Start-Service -Name "SNMP"
    Set-Service -Name "SNMPTrap" -StartupType Automatic
    Start-Service -Name "SNMPTrap"
    Write-Host " - SNMP and SNMPTrap services are running and set to Automatic." -ForegroundColor Green


    # Step 3: Configure Registry for Traps
    Write-Host "Step 3: Configuring SNMP registry settings..." -ForegroundColor Yellow
    $CommunityString = "public"
    
    # Define registry paths
    $validCommunitiesPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\ValidCommunities"
    $trapConfigPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"

    # Set ReadOnly community string
    Set-ItemProperty -Path $validCommunitiesPath -Name $CommunityString -Value 4 -ErrorAction Stop
    Write-Host " - Community string '$CommunityString' set to ReadOnly."

    # Create TrapConfiguration key if it doesn't exist
    if (-not (Test-Path -Path $trapConfigPath)) {
        New-Item -Path $trapConfigPath -Force | Out-Null
    }
    
    # Set the trap destination from the script parameter
    Set-ItemProperty -Path $trapConfigPath -Name "1" -Value $TrapDestination -ErrorAction Stop
    Write-Host " - Trap destination set to '$TrapDestination'." -ForegroundColor Green

    # Step 4: Configure Firewall
    Write-Host "Step 4: Configuring Windows Firewall..." -ForegroundColor Yellow
    $ruleName = "SNMP Traps (UDP-Out)"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

    if (-not $firewallRule) {
        Write-Host " - Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Protocol UDP -RemotePort 162 -Action Allow
    } else {
        Write-Host " - Firewall rule '$ruleName' already exists. Ensuring it's enabled."
        Enable-NetFirewallRule -DisplayName $ruleName
    }
    Write-Host " - Firewall configured." -ForegroundColor Green

    # Step 5: Restart Service to apply all changes and trigger an initial trap
    Write-Host "Step 5: Restarting SNMP service to apply settings and send a test trap..." -ForegroundColor Yellow
    Restart-Service -Name "SNMP" -Force
    
    Write-Host "SNMP configuration completed successfully." -ForegroundColor Green
    exit 0

} catch {
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}
