
# This script is executed remotely by PsExec to set up the Atlas Monitoring Agent.

# --- Configuration ---
# The ComputerName is injected by the calling Python script.
# This variable is a placeholder for the script content.
$ComputerName = $env:COMPUTERNAME
$AtlasFolder = "C:\Atlas"
$OutputFile = Join-Path -Path $AtlasFolder -ChildPath "$($ComputerName).json"

# --- Main Logic ---

# 1. Define the command to be executed by the scheduled task
$CommandToRun = {
    param($OutputPath)

    # Performance Data Collection
    $cpuUsage = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1).CounterSamples.CookedValue
    $totalMemory = (Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory
    $freeMemory = (Get-Counter -Counter "\Memory\Available Bytes").CounterSamples.CookedValue
    $usedMemoryBytes = $totalMemory - $freeMemory
    $usedMemoryGB = $usedMemoryBytes / 1GB
    
    $perfData = @{
        timestamp = (Get-Date).ToUniversalTime().ToString("o"); # ISO 8601 Format
        cpuUsage = $cpuUsage;
        usedMemoryGB = $usedMemoryGB;
        totalMemoryGB = [math]::Round($totalMemory / 1GB, 2);
    }
    
    # Ensure directory exists and write to file
    $Dir = Split-Path -Path $OutputPath -Parent
    if (-not (Test-Path -Path $Dir)) {
        New-Item -Path $Dir -ItemType Directory -Force | Out-Null
    }
    
    ConvertTo-Json -InputObject $perfData -Compress | Out-File -FilePath $OutputPath -Encoding utf8 -Force
}

# 2. Encode the command for PowerShell execution
$EncodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandToRun.ToString()))
$Argument = "-EncodedCommand $($EncodedCommand) -OutputPath '$($OutputFile)'"


# 3. Define the action for the scheduled task
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $Argument -WindowStyle Hidden

# 4. Define the trigger to run the task every 1 minute
$Trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 1) -Once -At (Get-Date)

# 5. Define the principal for the task to run as SYSTEM
$Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# 6. Define the settings for the task
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# 7. Register the scheduled task, replacing it if it already exists
Register-ScheduledTask -TaskName "Atlas Performance Monitor" -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "Collects system performance data for the Atlas Control Panel." -Force

Write-Host "Atlas Agent deployment task has been successfully created or updated on $($env:COMPUTERNAME)."
