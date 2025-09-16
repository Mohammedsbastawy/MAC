[CmdletBinding()]
param (
    [string]$DeviceName = (Get-CimInstance -ClassName Win32_ComputerSystem).Name
)

try {
    $TaskName = "AtlasPerfAgent"
    $TaskDescription = "Collects performance data for the Atlas Control Panel."
    $AtlasDir = "C:\Atlas"

    # Ensure the directory exists
    if (-not (Test-Path -Path $AtlasDir)) {
        New-Item -Path $AtlasDir -ItemType Directory -Force
    }
    
    $OutputFile = Join-Path -Path $AtlasDir -ChildPath "$($DeviceName).json"

    # Command to be run by the scheduled task. This entire block is converted to a string and encoded.
    $CommandToRun = {
        $ErrorActionPreference = 'SilentlyContinue'
        
        # Get CPU Usage using a reliable method with retries
        $CpuCounter = '\Processor(_Total)\% Processor Time'
        $CpuSample = $null
        $RetryCount = 0
        while ($CpuSample -eq $null -and $RetryCount -lt 3) {
            try {
                $CpuSample = (Get-Counter -Counter $CpuCounter).CounterSamples.CookedValue
            } catch {
                Start-Sleep -Milliseconds 200
            }
            $RetryCount++
        }

        # Get Memory Info
        $MemInfo = Get-CimInstance -ClassName Win32_OperatingSystem
        $TotalMemoryGB = $MemInfo.TotalVisibleMemorySize / 1MB 
        $UsedMemoryGB = ($MemInfo.TotalVisibleMemorySize - $MemInfo.FreePhysicalMemory) / 1MB

        # Get Disk Info for all fixed disks
        $Disks = Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter } | ForEach-Object {
            @{
                volume = $_.DriveLetter;
                totalSizeGB = [math]::Round($_.Size / 1GB, 2);
                freeSpaceGB = [math]::Round($_.SizeRemaining / 1GB, 2);
            }
        }

        # Create the final object
        $PerfData = @{
            timestamp = (Get-Date).ToUniversalTime().ToString('o');
            cpuUsage = [math]::Round($CpuSample, 2);
            totalMemoryGB = [math]::Round($TotalMemoryGB, 2);
            usedMemoryGB = [math]::Round($UsedMemoryGB, 2);
            diskInfo = $Disks;
        }

        # Write to JSON file
        $PerfData | ConvertTo-Json -Compress | Out-File -FilePath $using:OutputFile -Encoding utf8 -Force
    }

    # *** CRITICAL FIX: Convert the script block to a string before encoding ***
    $CommandString = $CommandToRun.ToString()
    $EncodedCommand = [System.Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandString))

    # Define the action for the scheduled task
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand $EncodedCommand"
    
    # Define the trigger (runs every minute)
    $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([TimeSpan]::MaxValue)
    
    # Define the principal
    $TaskPrincipal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    # Define the settings
    $TaskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

    # Register the task, overwriting if it exists
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $TaskPrincipal -Settings $TaskSettings -Description $TaskDescription -Force
    
    # Output success message
    Write-Host "Atlas Agent scheduled task has been created/updated successfully."

} catch {
    # If any unhandled error occurs, write it to stderr and exit with a non-zero code
    $ErrorMessage = "An error occurred: $($_.Exception.Message)"
    $PSCmdlet.WriteError($ErrorMessage)
    exit 1
}
