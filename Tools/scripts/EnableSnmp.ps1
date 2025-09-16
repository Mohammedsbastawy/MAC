# Universal PowerShell Script to Install and Configure SNMP Service
# Compatible with modern Windows Client and Server editions.

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
    # Step 1: Install SNMP Service if not present
    Write-Host "Step 1: Checking for SNMP Service..." -ForegroundColor Yellow
    
    $snmpService = Get-Service -Name "SNMP" -ErrorAction SilentlyContinue
    if (-not $snmpService) {
        Write-Host "SNMP Service not found. Attempting to install it as a Windows Capability (for Win10/11/Server 2019+)..." -ForegroundColor Yellow
        try {
            # Modern method for Windows 10/11 and Server 2019+
            $capability = Get-WindowsCapability -Online -Name "SNMP.Client~~~~0.0.1.0"
            if ($capability.State -ne 'Installed') {
                Add-WindowsCapability -Online -Name "SNMP.Client~~~~0.0.1.0" -LimitAccess -Source "C:\Windows\WinSxS"
                Write-Host "Successfully installed SNMP via Add-WindowsCapability." -ForegroundColor Green
            } else {
                 Write-Host "SNMP capability is already installed." -ForegroundColor Green
            }
        } catch {
             Write-Warning "Add-WindowsCapability failed. Trying Install-WindowsFeature for older servers..."
             try {
                # Fallback for older Windows Servers
                Install-WindowsFeature SNMP-Service -IncludeManagementTools
                Write-Host "Successfully installed SNMP via Install-WindowsFeature." -ForegroundColor Green
             } catch {
                Write-Error "Failed to install SNMP using both modern and legacy methods. Please install it manually on the target machine."
                exit 1
             }
        }
    } else {
        Write-Host "SNMP Service is already installed." -ForegroundColor Green
    }


    # Step 2: Configure and Start Services
    Write-Host "Step 2: Ensuring SNMP Service and SNMP Trap Service are set to Automatic and started..." -ForegroundColor Yellow
    Set-Service -Name "SNMP" -StartupType Automatic
    Start-Service -Name "SNMP"
    
    # SNMPTrap service might not be present on all systems, so we handle the error
    $trapService = Get-Service -Name "SNMPTrap" -ErrorAction SilentlyContinue
    if ($trapService) {
        Set-Service -Name "SNMPTrap" -StartupType Automatic
        Start-Service -Name "SNMPTrap"
    } else {
        Write-Warning "SNMP Trap service not found. This is normal on some Windows versions."
    }
    Write-Host "Services are configured and running." -ForegroundColor Green

    # Step 3: Configure Registry for Community String and Trap Destination
    Write-Host "Step 3: Configuring SNMP registry settings..." -ForegroundColor Yellow
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\ValidCommunities"
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
    Set-ItemProperty -Path $regPath -Name $CommunityString -Value 4 -Type DWORD -Force
    Write-Host " - Community string '$CommunityString' set to ReadOnly."

    $trapConfigPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"
    if (-not (Test-Path $trapConfigPath)) { New-Item -Path $trapConfigPath -Force | Out-Null }
    # Clear existing traps before adding the new one
    Get-Item -Path $trapConfigPath | Get-ItemProperty | ForEach-Object { Remove-ItemProperty -Path $_.PSPath -Name $_.PSChildName -Force }
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

    # Step 5: Restart service to apply changes and send initial trap
    Write-Host "Step 5: Restarting service to apply changes and send initial trap..." -ForegroundColor Yellow
    Restart-Service -Name "SNMP" -Force
    
    Write-Host "SNMP configuration completed successfully." -ForegroundColor Green

} catch {
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}
