# Atlas Monitoring Agent - Self-Installing & Self-Running
# Runs Every 1 Minute via Task Scheduler
$ErrorActionPreference = "Stop"
$AgentPath = "C:\Atlas"
$TaskName = "AtlasMonitorAgent" # Changed name to be more specific
$ScriptPath = $MyInvocation.MyCommand.Path

function Collect-AtlasData {
    # Use CIM instance for a faster, non-blocking CPU read
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
    if (-not (Test-Path -Path $AgentPath -PathType Container)) {
        New-Item -ItemType Directory -Path $AgentPath -Force
    }

    $taskExists = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

    if (-not $taskExists) {
        # First-time run: Collect data and then create the scheduled task.
        Collect-AtlasData

        $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
        
        # This trigger runs once 1 minute from now, and then repeats every minute indefinitely.
        $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)

        $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
        
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
    }
    else {
        # Subsequent runs: Just collect the data.
        Collect-AtlasData
    }

} catch {
    $logPath = Join-Path -Path $AgentPath -ChildPath "MonitorAgentErrors.log"
    $errorMessage = "[$((Get-Date).ToString('o'))] Error: $($_.Exception.Message)"
    Add-Content -Path $logPath -Value $errorMessage
}
