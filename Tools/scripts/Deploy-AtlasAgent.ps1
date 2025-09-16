
# This script is executed on a remote machine to set up the Atlas Performance Agent.
# It creates a scheduled task that runs every minute to gather performance data.

# This placeholder is dynamically replaced by the Python backend before execution.
$ComputerName = '$ComputerNamePlaceholder$'

# --- Configuration ---
$TaskName = "Atlas Performance Monitor"
$TaskDescription = "Collects system performance data (CPU, Memory) for the Atlas Control Panel."
$LogDir = "C:\Atlas"
$LogFile = Join-Path $LogDir "$($ComputerName).json"

# --- Script to be Executed by the Scheduled Task ---
# This command block is encoded and passed to powershell.exe
$CommandToRun = @"
# Ensure the directory exists
if (-not (Test-Path -Path '$LogDir' -PathType Container)) {
    New-Item -Path '$LogDir' -ItemType Directory -Force | Out-Null
}

# Get CPU usage. It's important to get two samples for an accurate reading.
\$cpuSample = Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 2
\$cpuUsage = \$cpuSample.CounterSamples | Where-Object { \$_.Status -eq 0 } | Measure-Object -Property CookedValue -Average | Select-Object -ExpandProperty Average

# Get Memory usage
\$memory = Get-CimInstance -ClassName Win32_OperatingSystem
\$totalMemoryGB = \$memory.TotalVisibleMemorySize / 1MB 
\$freeMemoryGB = \$memory.FreePhysicalMemory / 1MB
\$usedMemoryGB = \$totalMemoryGB - \$freeMemoryGB

# Create performance data object
\$perfData = @{
    timestamp = (Get-Date).ToUniversalTime().ToString('o');
    cpuUsage = \$cpuUsage;
    totalMemoryGB = \$totalMemoryGB;
    usedMemoryGB = \$usedMemoryGB;
    diskInfo = @(Get-Volume | Where-Object { \$_.DriveType -eq 'Fixed' } | ForEach-Object {
        [pscustomobject]@{
            volume = \$_.DriveLetter;
            sizeGB = [math]::Round(\$_.Size / 1GB, 2);
            freeGB = [math]::Round(\$_.SizeRemaining / 1GB, 2);
        }
    })
}

# Convert to JSON and write to file
\$perfData | ConvertTo-Json -Depth 4 -Compress | Set-Content -Path '$LogFile' -Force
"@

# Encode the command for reliable execution
$EncodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandToRun))

# --- Scheduled Task Setup ---

# 1. Define the action to run PowerShell with the encoded command
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NonInteractive -NoProfile -WindowStyle Hidden -EncodedCommand $EncodedCommand"

# 2. Define the trigger to run every minute
$Trigger = New-ScheduledTaskTrigger -Repetitive -RepetitionInterval (New-TimeSpan -Minutes 1)

# 3. Define the principal (user) under which the task will run
$Principal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\Administrators" -RunLevel Highest

# 4. Define the task settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# 5. Register (create or update) the scheduled task
# Use -Force to overwrite any existing task with the same name.
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description $TaskDescription -Force

Write-Host "Scheduled task '$TaskName' has been created/updated successfully."
Write-Host "Agent will now log performance data to '$LogFile' every minute."

    