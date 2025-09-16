# Script to deploy the Atlas Performance Monitoring Agent

# This script is executed on the target machine via PsExec.

# --- Configuration ---
$TaskName = "Atlas Performance Monitor"
$ActionComputerName = '$ComputerNamePlaceholder$' # This placeholder is replaced by the Python backend before execution.
$LogDir = "C:\Atlas"
$LogFile = Join-Path $LogDir "$($ActionComputerName).json"

# --- Main Logic ---
try {
    # Step 1: Create the directory if it doesn't exist
    if (-not (Test-Path -Path $LogDir)) {
        Write-Host "Creating directory $LogDir..."
        New-Item -Path $LogDir -ItemType Directory -Force | Out-Null
    }

    # Step 2: Define the PowerShell command to be executed by the scheduled task.
    # This block collects performance data and writes it to a JSON file.
    $PowerShellCommand = @"
try {
    # Get CPU Usage. Takes two samples over a second for accuracy.
    \$cpuSample = Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 2;
    \$cpuUsage = \$cpuSample.CounterSamples.CookedValue | Measure-Object -Average | Select-Object -ExpandProperty Average;

    # Get Memory Info
    \$memInfo = Get-CimInstance -ClassName Win32_OperatingSystem;
    \$totalMemoryGB = \$memInfo.TotalVisibleMemorySize / 1MB; # From KB to GB
    \$usedMemoryGB = \$totalMemoryGB - (\$memInfo.FreePhysicalMemory / 1MB);

    # Get Disk Info for all fixed disks
    \$diskInfo = Get-Volume | Where-Object { \$_.DriveType -eq 'Fixed' } | ForEach-Object {
        [pscustomobject]@{
            volume = \$_.DriveLetter;
            sizeGB = [math]::Round(\$_.Size / 1GB, 2);
            freeGB = [math]::Round(\$_.SizeRemaining / 1GB, 2);
        }
    };
    
    # Assemble the data object
    \$perfData = @{
        timestamp = (Get-Date).ToUniversalTime().ToString('o');
        cpuUsage = [math]::Round(\$cpuUsage, 2);
        totalMemoryGB = [math]::Round(\$totalMemoryGB, 2);
        usedMemoryGB = [math]::Round(\$usedMemoryGB, 2);
        diskInfo = \$diskInfo;
    };

    # Convert to JSON and write to file
    \$perfData | ConvertTo-Json -Compress | Out-File -FilePath '$LogFile' -Encoding UTF8 -Force;
} catch {
    # Simple error logging if the script fails within the task
    "Error at `$(Get-Date): `$_" | Out-File -FilePath (Join-Path '$LogDir' 'agent-error.log') -Append
}
"@

    # Step 3: Define the action for the scheduled task - this is the robust way
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-Command `"$PowerShellCommand`""

    # Step 4: Define the trigger to run every 1 minute
    $Trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 1) -Once -At (Get-Date)

    # Step 5: Define settings for the task
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

    # Step 6: Register the task, overwriting if it already exists
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -User "NT AUTHORITY\SYSTEM" -RunLevel Highest -Force

    Write-Host "Scheduled task '$TaskName' has been successfully created/updated."
    Write-Host "Agent will now log performance data to '$LogFile' every minute."

} catch {
    Write-Error "An error occurred during agent deployment: $_"
    # Exit with a non-zero code to indicate failure to PsExec
    exit 1
}

# Exit with success code
exit 0
