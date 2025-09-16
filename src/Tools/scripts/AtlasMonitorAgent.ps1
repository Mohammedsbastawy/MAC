# Atlas Monitoring Agent - Self-installing and self-updating
$ErrorActionPreference = "Stop"
$AgentPath = "C:\Atlas"
$TaskName = "AtlasMonitorTask"
# This gets the full path of the script itself, which is needed for the scheduled task.
$ScriptPath = $MyInvocation.MyCommand.Path

# Function to collect data and write to JSON
function Collect-AtlasData {
    # Use a more reliable method to get CPU usage without sampling delays
    $cpuUsage = (Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Processor | Where-Object { $_.Name -eq '_Total' }).PercentProcessorTime

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
}

try {
    # Ensure the agent path exists
    if (-not (Test-Path -Path $AgentPath -PathType Container)) {
        New-Item -ItemType Directory -Path $AgentPath -Force
    }

    # Check if the task already exists
    $taskExists = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    if (-not $taskExists) {
        # First Run: Collect data immediately, then create the scheduled task.
        Collect-AtlasData

        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
        
        # Trigger to run every 1 minute, indefinitely.
        # This is the correct way to set an indefinite repetition without a duration.
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1)

        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force -Description "Atlas Monitoring Agent"
    }
    else {
        # Subsequent Runs (via Task Scheduler): Just collect the data.
        Collect-AtlasData
    }

} catch {
    # Log any errors to a local file for easier debugging.
    $logPath = Join-Path -Path $AgentPath -ChildPath "MonitorAgentErrors.log"
    $errorMessage = "[$((Get-Date).ToString('o'))] Error: $($_.Exception.Message)"
    # Use Add-Content to append errors without overwriting.
    Add-Content -Path $logPath -Value $errorMessage
}
