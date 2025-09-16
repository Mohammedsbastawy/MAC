# Universal PowerShell Script to Install and Configure SNMP Service
# Compatible with modern Windows Client and Server editions.

param (
    # This parameter is now primarily for manual execution.
    # The backend script will inject the IP directly.
    [string]$TrapDestination = "127.0.0.1"
)

# --- Configuration ---
$CommunityString = "public"

function Install-SnmpFeature {
    Write-Host "Attempting to install SNMP feature..." -ForegroundColor Cyan
    
    # Method 1: Modern Windows (Windows 10/11, Server 2019+)
    try {
        $capability = Get-WindowsCapability -Online -Name "SNMP.Client*" | Where-Object { $_.Name -like "SNMP.Client*" }
        if ($capability.State -ne 'Installed') {
            Write-Host "Using 'Add-WindowsCapability' for modern systems..."
            Add-WindowsCapability -Online -Name $capability.Name
            if ((Get-WindowsCapability -Online -Name $capability.Name).State -eq 'Installed') {
                 Write-Host "SNMP installed successfully via Add-WindowsCapability." -ForegroundColor Green
                 return $true
            }
        } else {
             Write-Host "SNMP capability is already installed." -ForegroundColor Green
             return $true
        }
    } catch {
        Write-Warning "Add-WindowsCapability failed. This might be an older system. Error: $_"
    }

    # Method 2: Older Windows Server
    try {
        if ((Get-WindowsFeature -Name "SNMP-Service").Installed -ne $true) {
            Write-Host "Using 'Install-WindowsFeature' for older server systems..."
            Install-WindowsFeature "SNMP-Service"
            if ((Get-WindowsFeature -Name "SNMP-Service").Installed -eq $true) {
                 Write-Host "SNMP installed successfully via Install-WindowsFeature." -ForegroundColor Green
                 return $true
            }
        } else {
             Write-Host "SNMP feature is already installed." -ForegroundColor Green
             return $true
        }
    } catch {
         Write-Warning "Install-WindowsFeature failed. This might be a client OS. Error: $_"
    }

    # Method 3: DISM as a robust fallback
    try {
        Write-Host "Using DISM as a fallback..."
        dism.exe /online /enable-feature /featurename:SNMP /NoRestart
        # DISM doesn't give good feedback, so we check the service existence
        if (Get-Service -Name SNMP -ErrorAction SilentlyContinue) {
             Write-Host "SNMP installed successfully via DISM." -ForegroundColor Green
             return $true
        }
    } catch {
         Write-Warning "DISM command failed. Error: $_"
    }

    return $false
}


try {
    # Step 1: Install SNMP Service if not present
    Write-Host "Step 1: Checking for SNMP Service..." -ForegroundColor Yellow
    $snmpService = Get-Service -Name "SNMP" -ErrorAction SilentlyContinue
    if (-not $snmpService) {
        Write-Host "SNMP Service not found. Attempting installation..." -ForegroundColor Yellow
        if (-not (Install-SnmpFeature)) {
            Write-Error "Fatal: All attempts to install SNMP failed. Please install it manually on the target machine."
            exit 1
        }
        # Re-check for the service after installation
        $snmpService = Get-Service -Name "SNMP" -ErrorAction SilentlyContinue
        if (-not $snmpService) {
             Write-Error "Fatal: SNMP was installed but the service could not be found."
             exit 1
        }
    } else {
        Write-Host "SNMP Service is already installed." -ForegroundColor Green
    }

    # Step 2: Configure and Start Services
    Write-Host "Step 2: Configuring and starting services..." -ForegroundColor Yellow
    Set-Service -Name "SNMP" -StartupType Automatic
    Start-Service -Name "SNMP"
    # The SNMPTrap service may not exist on all systems, so we make it non-fatal
    Set-Service -Name "SNMPTrap" -StartupType Automatic -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue
    Write-Host "SNMP service is set to Automatic and started." -ForegroundColor Green

    # Step 3: Configure Registry for Community String and Trap Destination
    Write-Host "Step 3: Configuring SNMP registry settings..." -ForegroundColor Yellow
    
    # Set Community String
    $regPathCommunities = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\ValidCommunities"
    if (-not (Test-Path $regPathCommunities)) { New-Item -Path $regPathCommunities -Force | Out-Null }
    Set-ItemProperty -Path $regPathCommunities -Name $CommunityString -Value 4 -Type DWORD -Force
    Write-Host " - Community string '$CommunityString' set to ReadOnly."

    # Set Trap Destination
    $trapConfigPath = "HKLM:\SYSTEM\CurrentControlSet\Services\SNMP\Parameters\TrapConfiguration\$CommunityString"
    if (-not (Test-Path $trapConfigPath)) { New-Item -Path $trapConfigPath -Force | Out-Null }
    # Remove existing traps to prevent duplicates
    Get-Item -Path $trapConfigPath | Get-ItemProperty | ForEach-Object {
        if ($_.PSObject.Properties.Name -match '^\d+$') {
            Remove-ItemProperty -Path $trapConfigPath -Name $_.PSObject.Properties.Name -Force
        }
    }
    # Add the new trap destination
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
    try {
        Import-Module SNMPScripting -ErrorAction Stop
        Send-SnmpTrap -Community $CommunityString -Agent $env:COMPUTERNAME -Destination $TrapDestination -Generic 6 -Specific 1
        Write-Host "Test trap sent successfully." -ForegroundColor Green
    } catch {
        Write-Warning "Could not send test trap. The 'SNMPScripting' module might be missing or failed to import. Error: $_"
    }
    
    Write-Host "SNMP configuration completed successfully." -ForegroundColor Green

} catch {
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}