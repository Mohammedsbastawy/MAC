# Universal PowerShell Script to Install and Configure SNMP Service
# Compatible with Windows Client and Server editions.
param (
    [string]$TrapDestination
)

# --- Configuration ---
$CommunityString = "public"

if (-not $TrapDestination) {
    Write-Warning "Trap destination IP not provided. Defaulting to localhost."
    $TrapDestination = "127.0.0.1"
}

try {
    Write-Host "Step 1: Checking for SNMP Service..." -ForegroundColor Yellow
    
    # Check if the feature is installed
    $snmpCapability = Get-WindowsCapability -Online -Name "SNMP.Client*" | Where-Object { $_.Name -like "SNMP.Client*" }

    if ($snmpCapability.State -ne 'Installed') {
        Write-Host "SNMP Service not installed. Attempting installation with DISM..." -ForegroundColor Yellow
        # Use DISM as a robust method for installation
        dism.exe /online /enable-feature /featurename:SNMP
        Write-Host "DISM installation command executed." -ForegroundColor Green
    } else {
        Write-Host "SNMP Service is already installed." -ForegroundColor Green
    }

    # Verify the service now exists
    $snmpService = Get-Service -Name "SNMP" -ErrorAction SilentlyContinue
    if (-not $snmpService) {
        Write-Error "SNMP Service could not be installed or found after installation attempt."
        exit 1
    }

    Write-Host "Ensuring SNMP Service and SNMP Trap Service are set to Automatic and started..." -ForegroundColor Yellow
    Set-Service -Name "SNMP" -StartupType Automatic -PassThru | Start-Service
    # SNMPTrap service might not exist on all systems, so we use SilentlyContinue
    Set-Service -Name "SNMPTrap" -StartupType Automatic -ErrorAction SilentlyContinue -PassThru | Start-Service -ErrorAction SilentlyContinue
    Write-Host "Services are configured and running." -ForegroundColor Green


    Write-Host "Step 2: Configuring SNMP registry settings..." -ForegroundColor Yellow
    # Set Community String
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\ValidCommunities"
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
    Set-ItemProperty -Path $regPath -Name $CommunityString -Value 4 -Type DWORD -Force
    Write-Host " - Community string '$CommunityString' set to ReadOnly."

    # Set Trap Destination
    $trapConfigPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"
    if (-not (Test-Path $trapConfigPath)) { New-Item -Path $trapConfigPath -Force | Out-Null }
    Set-ItemProperty -Path $trapConfigPath -Name "1" -Value $TrapDestination -Type String -Force
    Write-Host " - Trap destination set to '$TrapDestination'."
    

    Write-Host "Step 3: Configuring Windows Firewall..." -ForegroundColor Yellow
    $ruleName = "SNMP Traps (UDP-Out)"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $firewallRule) {
        Write-Host " - Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Protocol UDP -RemotePort 162 -Action Allow
    } else {
        Write-Host " - Firewall rule '$ruleName' already exists. Ensuring it's enabled."
        Enable-NetFirewallRule -DisplayName $ruleName
    }
    Write-Host "Firewall configured." -ForegroundColor Green


    Write-Host "Step 4: Restarting service to apply changes and send initial trap..." -ForegroundColor Yellow
    Restart-Service -Name "SNMP" -Force
    
    Write-Host "SNMP configuration completed successfully." -ForegroundColor Green

} catch {
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}

exit 0
