#Requires -RunAsAdministrator

# This script creates a scheduled task to monitor performance and output it to a JSON file.
# It's designed to be executed remotely via PsExec.

# --- Configuration ---
$TaskName = "Atlas Performance Monitor"
$TaskDescription = "Monitors system performance (CPU, Memory, Disk) and writes it to a JSON file for the Atlas Control Panel."
$ErrorActionPreference = 'SilentlyContinue' # Prevents non-terminating errors from returning a non-zero exit code

# --- Main Script Block ---
# The entire logic is encapsulated in a script block for reliable execution via -EncodedCommand.
$CommandToRun = {
    # Define paths inside the command block to ensure scope is correct
    $AtlasFolder = "C:\Atlas"
    if (-not (Test-Path -Path $AtlasFolder)) {
        New-Item -Path $AtlasFolder -ItemType Directory -Force | Out-Null
    }
    # Use the computer name environment variable, which is always available
    $OutputFile = Join-Path -Path $AtlasFolder -ChildPath "$($env:COMPUTERNAME).json"

    # --- Performance Data Collection ---
    # This method is more robust for non-interactive sessions like a scheduled task.
    $cpuUsage = 0
    $retries = 2
    $i = 0
    while ($i -lt $retries) {
        $cpuSample = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 1).CounterSamples.CookedValue
        if ($cpuSample -is [double]) {
            $cpuUsage = $cpuSample
            break
        }
        Start-Sleep -Milliseconds 200
        $i++
    }

    $memory = Get-CimInstance -ClassName Win32_OperatingSystem
    $totalMemoryGB = $memory.TotalVisibleMemorySize / 1MB
    $usedMemoryGB = $totalMemoryGB - ($memory.FreePhysicalMemory / 1MB)

    $diskInfo = Get-CimInstance -ClassName Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | ForEach-Object {
        @{
            volume = $_.DeviceID;
            sizeGB = [math]::Round($_.Size / 1GB, 2);
            freeGB = [math]::Round($_.FreeSpace / 1GB, 2);
        }
    }
    
    # --- Assemble the JSON object ---
    $perfData = @{
        timestamp = (Get-Date).ToUniversalTime().ToString("o"); # ISO 8601 format
        cpuUsage = [math]::Round($cpuUsage, 2);
        totalMemoryGB = [math]::Round($totalMemoryGB, 2);
        usedMemoryGB = [math]::Round($usedMemoryGB, 2);
        diskInfo = $diskInfo;
    }

    # --- Write to File ---
    # Convert to JSON and write to the output file
    $perfData | ConvertTo-Json -Compress | Out-File -FilePath $OutputFile -Encoding utf8 -Force
}

# --- Scheduled Task Creation ---
# Encode the command for reliability
$EncodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandToRun.ToString()))

# Define the action to run the encoded command
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -EncodedCommand $EncodedCommand"

# Define the trigger to run every 1 minute
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([TimeSpan]::MaxValue)

# Define the principal (who runs the task) - SYSTEM for reliability
$TaskPrincipal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Define task settings
$TaskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# Unregister any existing task with the same name to ensure a clean update
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Register the new or updated scheduled task
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $TaskPrincipal -Settings $TaskSettings -Description $TaskDescription -Force

# Provide a success message to the output stream
Write-Host "Atlas Agent scheduled task has been created/updated successfully."

    