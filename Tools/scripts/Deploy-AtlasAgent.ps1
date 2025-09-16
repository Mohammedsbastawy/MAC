# PowerShell Script to Deploy the Atlas Performance Monitoring Agent

# This script creates a scheduled task that runs every minute to collect
# performance data and write it to a JSON file.

# --- Configuration ---
$TaskName = "Atlas Performance Monitor"
$AtlasFolder = "C:\Atlas"
$ComputerName = "$ComputerNamePlaceholder$" # This placeholder is replaced by the Python backend
$LogFile = Join-Path -Path $AtlasFolder -ChildPath "$ComputerName.json"

# --- Script Body ---

# 1. Create the Atlas directory if it doesn't exist
if (-not (Test-Path -Path $AtlasFolder -PathType Container)) {
    try {
        New-Item -Path $AtlasFolder -ItemType Directory -Force -ErrorAction Stop | Out-Null
        Write-Host "Successfully created directory: $AtlasFolder"
    }
    catch {
        Write-Error "Failed to create directory: $AtlasFolder. Error: $_"
        exit 1
    }
}

# 2. Define the action for the scheduled task
# This action gets performance counters and system info, then writes it to a JSON file.
$ActionScript = {
    param($FilePath)

    try {
        # Get CPU Usage (average over 1 second)
        $cpuSample = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 2).CounterSamples | Select-Object -Last 1
        $cpuUsage = [math]::Round($cpuSample.CookedValue, 2)

        # Get Memory Usage
        $totalMemory = (Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory
        $freeMemory = (Get-Counter -Counter "\Memory\Available Bytes").CounterSamples.CookedValue
        $usedMemoryGB = [math]::Round(($totalMemory - $freeMemory) / 1GB, 2)
        $totalMemoryGB = [math]::Round($totalMemory / 1GB, 2)

        # Get Disk Info for all fixed disks
        $diskInfo = Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' } | ForEach-Object {
            @{
                volume = $_.DriveLetter;
                sizeGB = [math]::Round($_.Size / 1GB, 2);
                freeGB = [math]::Round($_.SizeRemaining / 1GB, 2);
            }
        }

        # Construct the final JSON object
        $performanceData = @{
            cpuUsage       = $cpuUsage;
            totalMemoryGB  = $totalMemoryGB;
            usedMemoryGB   = $usedMemoryGB;
            diskInfo       = $diskInfo;
            timestamp      = (Get-Date).ToUniversalTime().ToString("o"); # ISO 8601 format
        }

        # Convert to JSON and write to the file
        $performanceData | ConvertTo-Json -Compress | Set-Content -Path $FilePath -Encoding UTF8 -Force
    }
    catch {
        # If something goes wrong, log the error to the file instead.
        $errorData = @{
            error = "Failed to collect performance data.";
            details = $_.ToString();
            timestamp = (Get-Date).ToUniversalTime().ToString("o");
        }
        $errorData | ConvertTo-Json -Compress | Set-Content -Path $FilePath -Encoding UTF8 -Force
    }
}

# 3. Define the scheduled task properties
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -Command & { $($ActionScript.ToString()) -FilePath '$LogFile' }"
$Trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 1) -Once -At (Get-Date)
$Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# 4. Register (create or update) the scheduled task
try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force -ErrorAction Stop
    Write-Host "Successfully registered scheduled task: $TaskName"
}
catch {
    Write-Error "Failed to register scheduled task: $TaskName. Error: $_"
    exit 1
}

Write-Host "Atlas Agent deployment script finished."
exit 0
