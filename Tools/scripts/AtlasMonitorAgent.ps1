# Atlas Monitoring Agent - Self-Installing and Running
# This script will run on the client machine.
# On first run, it collects data and creates a scheduled task to run itself every minute.
# On subsequent runs, it only collects data.

$ErrorActionPreference = "Stop"
$AgentPath = "C:\Atlas"
$TaskName = "AtlasMonitorTask"
# Get the full path of the script itself, so the scheduled task knows what to run.
$ScriptPath = $MyInvocation.MyCommand.Path

# Function to collect performance data and write it to a JSON file.
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
            timestamp     = (Get-Date).ToUniversalTime().ToString("o") # ISO 8601 format
        }

        # Define the path for the JSON file based on the computer name.
        $filePath = Join-Path -Path $AgentPath -ChildPath "$($env:COMPUTERNAME).json"
        
        # Convert to JSON and save to the local path.
        $data | ConvertTo-Json -Depth 4 -Compress | Set-Content -Path $filePath -Encoding UTF8 -Force
    } catch {
        # Log data collection errors to a file for troubleshooting.
        $logPath = Join-Path -Path $AgentPath -ChildPath "MonitorAgentErrors.log"
        $errorMessage = "[$((Get-Date).ToString('o'))] Data Collection Error: $($_.Exception.Message)"
        Add-Content -Path $logPath -Value $errorMessage
    }
}

try {
    # Ensure the destination directory exists.
    if (-not (Test-Path -Path $AgentPath -PathType Container)) {
        New-Item -ItemType Directory -Path $AgentPath -Force
    }

    # Check if the scheduled task has already been created.
    $taskExists = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    if (-not $taskExists) {
        # --- FIRST RUN LOGIC ---
        # 1. Collect data immediately to create the file on first run.
        Collect-AtlasData

        # 2. Create the action for the scheduled task. This will run the script itself.
        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
        
        # 3. Create the trigger to run every 1 minute, indefinitely.
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
                   -RepetitionInterval (New-TimeSpan -Minutes 1) `
                   -RepetitionDuration ([TimeSpan]::MaxValue)

        # 4. Define the user principal (SYSTEM) for the task to ensure it runs with high privileges.
        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

        # 5. Register the task. The -Force will overwrite if it somehow exists but wasn't detected.
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force
    }
    else {
        # --- SUBSEQUENT RUNS LOGIC ---
        # The task already exists, so just collect the data.
        Collect-AtlasData
    }

} catch {
    # Catch any errors during the setup or collection process (e.g., permission issues).
    $logPath = Join-Path -Path $AgentPath -ChildPath "MonitorAgentErrors.log"
    $errorMessage = "[$((Get-Date).ToString('o'))] Script-level Error: $($_.Exception.Message)"
    Add-Content -Path $logPath -Value $errorMessage
}
