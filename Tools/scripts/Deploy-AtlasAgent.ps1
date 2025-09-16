# PowerShell Script to Deploy the Atlas Monitoring Agent
# This script creates a scheduled task on the target machine to run every minute.

param(
    [string]$DeviceName = $env:COMPUTERNAME
)

try {
    $TaskName = "AtlasMonitoringAgent"
    $TaskDescription = "Collects system performance data (CPU, Memory, Disk) for the Atlas Control Panel."
    $AtlasFolder = "C:\Atlas"

    # --- Self-Contained Command Block ---
    # All logic must be inside this block to be correctly encoded and executed by the task.
    $CommandToRun = {
        # Define paths inside the command block
        $LogFolder = "C:\Atlas"
        $LogFile = Join-Path -Path $LogFolder -ChildPath "$($env:COMPUTERNAME).json"

        # Create folder if it doesn't exist
        if (-not (Test-Path -Path $LogFolder)) {
            New-Item -Path $LogFolder -ItemType Directory -Force | Out-Null
        }

        # --- Data Collection ---
        # Method 1: Get CPU via a reliable counter sample
        $cpuSample = $null
        $retries = 2
        $i = 0
        while ($i -lt $retries -and $cpuSample -eq $null) {
            try {
                $cpuSample = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 1).CounterSamples.CookedValue
            } catch {
                Start-Sleep -Milliseconds 250
            }
            $i++
        }
        $cpuUsage = if ($cpuSample -ne $null) { [math]::Round($cpuSample, 2) } else { 0 }

        # Method 2: Get Memory and Disk info from CIM
        $mem = Get-CimInstance -ClassName Win32_OperatingSystem
        $totalMemoryGB = [math]::Round($mem.TotalVisibleMemorySize / 1MB, 2)
        $freeMemoryGB = [math]::Round($mem.FreePhysicalMemory / 1MB, 2)
        $usedMemoryGB = $totalMemoryGB - $freeMemoryGB

        $disks = Get-CimInstance -ClassName Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | ForEach-Object {
            @{
                volume = $_.DeviceID;
                sizeGB = [math]::Round($_.Size / 1GB, 2);
                freeGB = [math]::Round($_.FreeSpace / 1GB, 2);
            }
        }

        # Method 3: Construct the final JSON object
        $perfData = @{
            timestamp = (Get-Date).ToUniversalTime().ToString("o");
            cpuUsage = $cpuUsage;
            totalMemoryGB = $totalMemoryGB;
            usedMemoryGB = [math]::Round($usedMemoryGB, 2);
            diskInfo = $disks;
        }

        # Write to file
        $perfData | ConvertTo-Json -Compress | Out-File -FilePath $LogFile -Encoding utf8 -Force
    }
    
    # --- Scheduled Task Creation ---
    
    # CRITICAL FIX: Encode the command block to Base64 to safely pass it as an argument
    $EncodedCommand = [System.Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandToRun))

    # Action: Run PowerShell hidden with the encoded command
    # CRITICAL FIX: The argument list is now correctly constructed as a single string.
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -EncodedCommand $EncodedCommand"

    # Trigger: Run every 1 minute, indefinitely
    $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration ([TimeSpan]::MaxValue)

    # Principal: Run as SYSTEM account with highest privileges
    $TaskPrincipal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    # Settings: Allow running on batteries, set an execution time limit
    $TaskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

    # Unregister any old version of the task silently
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    # Register the new task, overwriting if it exists
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $TaskPrincipal -Settings $TaskSettings -Description $TaskDescription -Force

    # Success message
    Write-Host "Atlas Agent scheduled task has been created/updated successfully."

} catch {
    # Error handling
    $ErrorMessage = "Failed to deploy Atlas Agent. Error on line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)"
    Write-Error $ErrorMessage
    exit 1
}

exit 0
