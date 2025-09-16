#Requires -RunAsAdministrator
# This script deploys and configures the Atlas performance monitoring agent.
# It creates a scheduled task that runs every minute to collect performance data.
$ErrorActionPreference = 'Stop'
try {
    # --- Configuration ---
    $TaskName = "AtlasAgentPerfMonitor"
    $TaskDescription = "Collects system performance data (CPU, Memory, Disk) for Atlas Control Panel."
    $AtlasDir = "C:\Atlas"
    # Get the computer name to use in the output file
    $DeviceName = $env:COMPUTERNAME
    
    # --- Ensure Atlas Directory Exists ---
    if (-not (Test-Path -Path $AtlasDir)) {
        Write-Host "Creating directory: $AtlasDir"
        New-Item -Path $AtlasDir -ItemType Directory -Force | Out-Null
    }
    # --- Define the command to be executed by the scheduled task ---
    # This script block gathers performance data and writes it to a JSON file.
    $CommandToRun = {
        # Suppress errors within the task itself to prevent it from failing silently
        $ErrorActionPreference = 'SilentlyContinue'
        $DeviceName = $env:COMPUTERNAME
        $OutputFile = "C:\Atlas\$($DeviceName).json"
        # Get CPU Usage - More robust method
        # This samples the processor usage over a brief period.
        $CpuCounter = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 2).CounterSamples | Select-Object -Last 1
        $CpuUsage = if ($CpuCounter) { [math]::Round($CpuCounter.CookedValue, 2) } else { 0 }
        # Get Memory Info
        $MemoryInfo = Get-CimInstance -ClassName Win32_OperatingSystem
        $TotalMemoryMB = [math]::Round($MemoryInfo.TotalVisibleMemorySize / 1024, 2)
        $UsedMemoryMB = [math]::Round(($MemoryInfo.TotalVisibleMemorySize - $MemoryInfo.FreePhysicalMemory) / 1024, 2)
        
        # Get Disk Info for all fixed disks
        $DiskInfo = Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and -not [string]::IsNullOrWhiteSpace($_.DriveLetter) } | ForEach-Object {
            @{
                volume = "$($_.DriveLetter):";
                sizeGB = [math]::Round($_.Size / 1GB, 2);
                freeGB = [math]::Round($_.SizeRemaining / 1GB, 2)
            }
        }
        # Create the final data object
        $PerformanceData = @{
            timestamp = [datetime]::UtcNow.ToString("o"); # ISO 8601 format
            cpuUsage = $CpuUsage;
            totalMemoryGB = $TotalMemoryMB; # This is actually MB now
            usedMemoryGB = $UsedMemoryMB; # This is actually MB now
            diskInfo = $DiskInfo;
        }
        # Convert to JSON and write to file
        $PerformanceData | ConvertTo-Json -Compress | Out-File -FilePath $OutputFile -Encoding utf8 -Force
    }
    # --- Immediate Execution ---
    # Run the command once immediately to create the file and confirm the script works.
    Write-Host "Performing initial data collection..." -ForegroundColor Yellow
    Invoke-Command -ScriptBlock $CommandToRun
    Write-Host "Initial data file created successfully." -ForegroundColor Yellow
    # --- Scheduled Task Creation ---
    # Convert the script block to a string correctly and then encode it for the task argument
    # We get the string content of the script block, not the block itself.
    $CommandString = $CommandToRun.ToString()
    $EncodedCommand = [System.Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandString))
    
    # Define the action for the scheduled task
    # This runs PowerShell without a profile, in a hidden window, executing the encoded command.
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -EncodedCommand $EncodedCommand"
    # Define the trigger: Run every 1 minute indefinitely
    $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 9999)
    # Define the principal (who runs the task) - SYSTEM for reliability
    $TaskPrincipal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    # Define task settings
    $TaskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
    # Unregister any existing task with the same name to ensure a clean slate
    Write-Host "Unregistering any existing task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    # Register the new scheduled task
    Write-Host "Registering the new scheduled task..." -ForegroundColor Yellow
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $TaskPrincipal -Settings $TaskSettings -Description $TaskDescription -Force
    Write-Host "Atlas Agent scheduled task has been created/updated successfully." -ForegroundColor Green
    
    # Optional: Display task info for verification
    Get-ScheduledTask -TaskName $TaskName

} catch {
    Write-Error "Agent deployment failed: $_"
    # Exit with a non-zero status code to indicate failure to PsExec
    exit 1
}
