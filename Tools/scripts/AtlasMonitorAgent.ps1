# Atlas Monitoring Agent - Self-installing and self-scheduling.
# Runs Every 1 Minute via Task Scheduler.
$ErrorActionPreference = "Stop"
$AgentPath = "C:\Atlas"
$TaskName = "AtlasMonitorTask"
# Get the full path of the script itself, to be used in the scheduled task.
$ScriptPath = $MyInvocation.MyCommand.Path

# Function to collect system data and write it to a JSON file.
function Collect-AtlasData {
    try {
        $cpuCounter = Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 1
        $cpuUsage = $cpuCounter.CounterSamples.CookedValue

        $os = Get-CimInstance -ClassName Win32_OperatingSystem
        $totalMemoryGB = $os.TotalVisibleMemorySize / 1GB
        $usedMemoryGB = ($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1GB

        $disks = Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter } | ForEach-Object {
            [pscustomobject]@{
                volume = $_.DriveLetter;
                sizeGB = [math]::Round($_.Size / 1GB, 2);
                freeGB = [math]::Round($_.SizeRemaining / 1GB, 2);
            }
        }

        $data = [PSCustomObject]@{
            cpuUsage      = [math]::Round($cpuUsage, 2)
            totalMemoryGB = [math]::Round($totalMemoryGB, 2)
            usedMemoryGB  = [math]::Round($usedMemoryGB, 2)
            diskInfo      = $disks
            timestamp     = (Get-Date).ToUniversalTime().ToString("o")
        }

        $filePath = Join-Path -Path $AgentPath -ChildPath "$($env:COMPUTERNAME).json"
        $data | ConvertTo-Json -Depth 4 -Compress | Set-Content -Path $filePath -Encoding UTF8 -Force
    } catch {
        # If data collection fails, log the error but don't stop the whole script.
        $logPath = Join-Path -Path $AgentPath -ChildPath "MonitorAgentErrors.log"
        $errorMessage = "[$((Get-Date).ToString('o'))] Data Collection Error: $($_.Exception.Message)"
        Add-Content -Path $logPath -Value $errorMessage
    }
}

try {
    # --- Main Script Logic ---

    # Ensure the destination directory exists.
    if (-not (Test-Path -Path $AgentPath -PathType Container)) {
        New-Item -ItemType Directory -Path $AgentPath -Force
    }

    # Check if the scheduled task already exists.
    $taskExists = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    if (-not $taskExists) {
        # --- First Run Logic ---
        # 1. Collect data immediately to create the JSON file on first run.
        Collect-AtlasData

        # 2. Define the action for the scheduled task: run this script.
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
        
        # 3. Define the trigger: repeat every 1 minute, starting 1 minute from now.
        #    By OMITTING -RepetitionDuration, the task repeats indefinitely. THIS IS THE FIX.
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)

        # 4. Define the principal: run as SYSTEM with highest privileges.
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

        # 5. Register the task.
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force
    }
    else {
        # --- Subsequent Runs Logic ---
        # If the task already exists, this script is being run by the task.
        # Just collect the data.
        Collect-AtlasData
    }

} catch {
    # --- Global Error Handling ---
    # Log any errors that occur during task creation or other top-level operations.
    $logPath = Join-Path -Path $AgentPath -ChildPath "MonitorAgentErrors.log"
    $errorMessage = "[$((Get-Date).ToString('o'))] Script-level Error: $($_.Exception.Message)"
    Add-Content -Path $logPath -Value $errorMessage
}
