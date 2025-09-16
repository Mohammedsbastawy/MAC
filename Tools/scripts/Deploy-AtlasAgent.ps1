
#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Deploys the Atlas Performance Monitoring agent as a scheduled task.

.DESCRIPTION
    This script creates a scheduled task that runs every minute to collect
    performance data (CPU, Memory, Disk) and writes it to a JSON file
    in C:\Atlas for the main control panel to retrieve.
#>

$CommandToRun = {
    # Define paths inside the command block to ensure scope is correct
    $AtlasFolder = "C:\Atlas"
    $OutputFile = Join-Path -Path $AtlasFolder -ChildPath "$($env:COMPUTERNAME).json"

    # Create the directory if it doesn't exist
    if (-not (Test-Path -Path $AtlasFolder)) {
        try {
            New-Item -Path $AtlasFolder -ItemType Directory -Force -ErrorAction Stop | Out-Null
        }
        catch {
            # If we can't create the folder, exit silently.
            return
        }
    }

    # --- Performance Data Collection ---
    $cpuUsage = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1).CounterSamples.CookedValue
    $totalMemory = (Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory
    $freeMemory = (Get-Counter -Counter "\Memory\Available Bytes").CounterSamples.CookedValue
    $usedMemory = $totalMemory - $freeMemory

    $perfData = @{
        timestamp = (Get-Date).ToUniversalTime().ToString('o');
        cpuUsage = $cpuUsage;
        usedMemoryGB = [math]::Round($usedMemory / 1GB, 2);
    }
    
    # Write to the file, ensuring it's overwritten each time
    try {
        $perfData | ConvertTo-Json -Compress | Out-File -FilePath $OutputFile -Encoding utf8 -Force -ErrorAction Stop
    }
    catch {
        # Silently fail if file cannot be written to
        return
    }
}

# Encode the command for reliable execution
$EncodedCommand = [System.Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandToRun.ToString()))

# Define the action for the scheduled task
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -EncodedCommand $EncodedCommand"

# Define the trigger to run every 1 minute, indefinitely
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([System.TimeSpan]::MaxValue)

# Define the settings for the task
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# Define the principal for the task (runs as SYSTEM)
$Principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Register the scheduled task, replacing it if it already exists
$TaskName = "Atlas Performance Monitor"
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force

Write-Host "Scheduled task '$TaskName' has been created/updated successfully."
