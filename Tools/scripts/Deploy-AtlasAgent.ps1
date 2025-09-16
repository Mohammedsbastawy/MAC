# PowerShell Script to Deploy the Atlas Performance Monitoring Agent

# This script creates a scheduled task on the target machine to periodically
# collect performance data and save it to a local JSON file.

# Suppress errors to prevent pop-ups on the target machine
$ErrorActionPreference = "SilentlyContinue"

# --- Main Command Block ---
# This entire block will be converted to a Base64 string and passed to powershell.exe
# This is the most reliable way to run complex commands in a scheduled task.
$CommandToRun = {
    # Define paths
    $AtlasFolder = "C:\Atlas"
    # Use the built-in environment variable to get the computer name dynamically
    $OutputFile = Join-Path -Path $AtlasFolder -ChildPath "$($env:COMPUTERNAME).json"

    # Create the directory if it doesn't exist
    if (-not (Test-Path -Path $AtlasFolder)) {
        New-Item -Path $AtlasFolder -ItemType Directory -Force | Out-Null
    }

    # --- Data Collection ---
    # Get CPU Usage - This is a reliable way to get a snapshot
    $CpuUsage = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 2).CounterSamples | Select-Object -ExpandProperty CookedValue | Select-Object -Last 1
    
    # Get Memory Info
    $MemoryInfo = Get-CimInstance -ClassName Win32_OperatingSystem
    $TotalMemoryGB = $MemoryInfo.TotalVisibleMemorySize / 1MB 
    $UsedMemoryGB = $TotalMemoryGB - ($MemoryInfo.FreePhysicalMemory / 1MB)

    # Get Disk Info for all fixed disks
    $DiskInfo = Get-CimInstance -ClassName Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | ForEach-Object {
        @{
            volume = $_.DeviceID;
            sizeGB = [math]::Round($_.Size / 1GB, 2);
            freeGB = [math]::Round($_.FreeSpace / 1GB, 2)
        }
    }

    # Create the final data object
    $perfData = @{
        timestamp = (Get-Date).ToUniversalTime().ToString("o"); # ISO 8601 format
        cpuUsage = [math]::Round($CpuUsage, 2);
        totalMemoryGB = [math]::Round($TotalMemoryGB, 2);
        usedMemoryGB = [math]::Round($UsedMemoryGB, 2);
        diskInfo = $DiskInfo;
    }

    # Write the object to the JSON file
    $perfData | ConvertTo-Json -Compress | Out-File -FilePath $OutputFile -Encoding utf8 -Force
}

# --- Scheduled Task Setup ---

# Define task settings
$TaskName = "Atlas Performance Monitor"
$TaskDescription = "Collects system performance data for the Atlas Control Panel."
$TaskPrincipal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$TaskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# Define the trigger to run every 1 minute, indefinitely
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([TimeSpan]::MaxValue)

# Convert the command block to an encoded command for reliability
$EncodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandToRun.ToString()))

# Define the action to run PowerShell with the hidden, encoded command
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -EncodedCommand $EncodedCommand"

# Unregister the task if it already exists, then register the new one
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $TaskPrincipal -Settings $TaskSettings -Description $TaskDescription -Force

# Confirm the task is registered
Write-Host "Atlas Agent scheduled task has been created/updated successfully."
Get-ScheduledTask -TaskName $TaskName | Format-List *

    