# Universal PowerShell Script to Install and Configure SNMP Service
# Compatible with modern Windows Client and Server editions.

# This variable will be defined and injected by the calling Python script.
# Example: $TrapDestination = '192.168.1.10'

# --- Configuration ---
$CommunityString = "public"

try {
    # Step 1: Install SNMP Service using modern and legacy methods
    Write-Host "Step 1: Checking for SNMP Service..." -ForegroundColor Yellow
    $snmpCapability = Get-WindowsCapability -Online -Name "SNMP.Client*" | Where-Object { $_.Name -like 'SNMP.Client*' }

    if ($snmpCapability.State -ne 'Installed') {
        Write-Host "SNMP feature is not installed. Attempting installation with Add-WindowsCapability..."
        Add-WindowsCapability -Online -Name $snmpCapability.Name -ErrorAction SilentlyContinue
        
        # Verify installation
        $snmpCapability = Get-WindowsCapability -Online -Name "SNMP.Client*" | Where-Object { $_.Name -like 'SNMP.Client*' }
        if ($snmpCapability.State -ne 'Installed') {
             Write-Host "Add-WindowsCapability failed. Falling back to legacy DISM..." -ForegroundColor Yellow
             dism.exe /online /enable-feature /featurename:SNMP /NoRestart
        }

    } else {
        Write-Host "SNMP Service is already installed." -ForegroundColor Green
    }

    # Step 2: Configure and Start Services
    Write-Host "Step 2: Configuring and starting services..." -ForegroundColor Yellow
    Set-Service -Name "SNMP" -StartupType Automatic
    Start-Service -Name "SNMP"
    Set-Service -Name "SNMPTrap" -StartupType Automatic
    Start-Service -Name "SNMPTrap"
    Write-Host "SNMP and SNMPTrap services are set to Automatic and started." -ForegroundColor Green

    # Step 3: Configure Registry for Community String and Trap Destination
    Write-Host "Step 3: Configuring SNMP registry settings..." -ForegroundColor Yellow
    
    # Set Community String
    $regPathCommunities = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\ValidCommunities"
    if (-not (Test-Path $regPathCommunities)) { New-Item -Path $regPathCommunities -Force | Out-Null }
    Set-ItemProperty -Path $regPathCommunities -Name $CommunityString -Value 4 -Type DWORD -Force
    Write-Host " - Community string '$CommunityString' set to ReadOnly."

    # Set Trap Destination
    $trapConfigPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\TrapConfiguration\\$CommunityString"
    if (-not (Test-Path $trapConfigPath)) { New-Item -Path $trapConfigPath -Force | Out-Null }
    Set-ItemProperty -Path $trapConfigPath -Name "1" -Value $TrapDestination -Type String -Force
    Write-Host " - Trap destination set to '$TrapDestination'."

    # Step 4: Configure Windows Firewall
    Write-Host "Step 4: Configuring Windows Firewall..." -ForegroundColor Yellow
    $ruleName = "SNMP Traps (UDP-Out)"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $firewallRule) {
        Write-Host " - Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Protocol UDP -RemotePort 162 -Action Allow
    } else {
        Write-Host " - Firewall rule '$ruleName' already exists. Ensuring it's enabled."
        $firewallRule | Enable-NetFirewallRule
    }
    Write-Host "Firewall configured." -ForegroundColor Green

    # Step 5: Send a test trap to confirm configuration
    Write-Host "Step 5: Sending a test trap to confirm configuration..." -ForegroundColor Yellow
    # This module is installed with the SNMP feature
    Import-Module SNMPScripting
    Send-SnmpTrap -Community $CommunityString -Agent $env:COMPUTERNAME -Destination $TrapDestination -Generic 6 -Specific 1
    
    Write-Host "SNMP configuration completed successfully." -ForegroundColor Green

} catch {
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}