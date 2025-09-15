# Atlas Monitoring Agent Script
# This script gathers performance data and saves it to a local JSON file.

# Ensure the script stops on errors and the destination directory exists.
$ErrorActionPreference = "Stop"
$AgentPath = "C:\Atlas"

try {
    # This command ensures the C:\Atlas directory exists. If it does, nothing happens. If it doesn't, it is created.
    if (-not (Test-Path -Path $AgentPath -PathType Container)) {
        New-Item -ItemType Directory -Path $AgentPath -Force
    }

    # 1. Gather Performance Data
    # Use a brief sample interval for a more accurate point-in-time reading.
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

    # 2. Create the Data Object
    $data = [PSCustomObject]@{
        cpuUsage      = [math]::Round($cpuUsage, 2)
        totalMemoryGB = [math]::Round($totalMemoryGB, 2)
        usedMemoryGB  = [math]::Round($usedMemoryGB, 2)
        diskInfo      = $disks
        timestamp     = (Get-Date).ToUniversalTime().ToString("o") # ISO 8601 format
    }

    # 3. Define the local path and save the file
    $filePath = Join-Path -Path $AgentPath -ChildPath "$($env:COMPUTERNAME).json"

    # Convert to JSON and save to the local path
    $data | ConvertTo-Json -Depth 4 -Compress | Set-Content -Path $filePath -Encoding UTF8 -Force

} catch {
    # Optional: For troubleshooting, you can write errors to a local log file.
    # For example:
    # $logPath = "C:\Atlas\MonitorAgentErrors.log"
    # $errorMessage = "[$((Get-Date).ToString('o'))] Error: $($_.Exception.Message)"
    # Add-Content -Path $logPath -Value $errorMessage
}
