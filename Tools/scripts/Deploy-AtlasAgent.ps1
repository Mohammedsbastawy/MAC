
# This script is executed on the remote machine via PsExec to create a scheduled task
# that collects performance data and saves it to a local JSON file.

try {
    $TaskName = "AtlasAgentPerfCollector"
    $TaskDescription = "Collects system performance data (CPU, Memory, Disk) for the Atlas Control Panel."
    $AtlasFolder = "C:\Atlas"
    
    # The command that the scheduled task will execute every minute.
    # It now defines its own output path using the machine's name.
    $CommandToRun = {
        # Define paths inside the command block to ensure scope is correct
        $LocalAtlasFolder = "C:\Atlas"
        $LocalOutputFile = Join-Path -Path $LocalAtlasFolder -ChildPath "$($env:COMPUTERNAME).json"

        # Ensure the directory exists
        if (-not (Test-Path -Path $LocalAtlasFolder)) {
            New-Item -Path $LocalAtlasFolder -ItemType Directory -Force | Out-Null
        }

        # --- Data Collection ---
        
        # Get Memory Info
        $memory = Get-CimInstance -ClassName Win32_OperatingSystem
        $totalMemoryGB = [math]::Round($memory.TotalVisibleMemorySize / 1MB, 2)
        $usedMemoryGB = [math]::Round(($memory.TotalVisibleMemorySize - $memory.FreePhysicalMemory) / 1MB, 2)
        
        # Get CPU Usage (fault-tolerant method)
        $cpuUsage = 0
        $i = 0
        while ($i -lt 2) {
            try {
                # Attempt to get a single, stable CPU counter sample.
                $cpuUsage = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop).CounterSamples.CookedValue
                break # Exit loop on success
            } catch {
                # If it fails, wait a moment and try one more time.
                Start-Sleep -Seconds 1
                $i++
            }
        }

        # Get Disk Info for all fixed disks
        $diskInfo = Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter } | ForEach-Object {
            [pscustomobject]@{
                volume = $_.DriveLetter
                sizeGB = [math]::Round($_.Size / 1GB, 2)
                freeGB = [math]::Round($_.SizeRemaining / 1GB, 2)
            }
        }

        # --- Assemble the final data object ---
        $perfData = [pscustomobject]@{
            timestamp = [datetime]::UtcNow.ToString("o") # ISO 8601 format
            cpuUsage = [math]::Round($cpuUsage, 2)
            totalMemoryGB = $totalMemoryGB
            usedMemoryGB = $usedMemoryGB
            diskInfo = $diskInfo
        }

        # Write to file
        $perfData | ConvertTo-Json -Compress | Out-File -FilePath $LocalOutputFile -Encoding utf8 -Force
    }
    
    # Convert the command block to a Base64 encoded string for reliable execution
    $EncodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandToRun.ToString()))
    
    # Define who the task runs as (SYSTEM account for reliability)
    $TaskPrincipal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    
    # Define task settings (run on battery, don't stop, etc.)
    $TaskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
    
    # Define the trigger (runs every 1 minute, indefinitely)
    $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([TimeSpan]::MaxValue)
    
    # Define the action (run powershell, hidden, with the encoded command)
    # This is the corrected line. We embed the variable directly into the argument string.
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -EncodedCommand $($EncodedCommand)"
    
    # Unregister any old version of the task to ensure a clean slate
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    
    # Register the new task with all the defined components
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $TaskPrincipal -Settings $TaskSettings -Description $TaskDescription -Force
    
    Write-Host "Atlas Agent scheduled task has been created/updated successfully."

} catch {
    # If any unrecoverable error occurs, write it to stderr and exit with an error code
    $ErrorMessage = "Failed to deploy Atlas Agent. Error on line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)"
    Write-Error $ErrorMessage
    exit 1
}

# Exit with success code 0 if the try block completed.
exit 0
