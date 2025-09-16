#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Deploys a performance monitoring scheduled task on a remote machine.
.DESCRIPTION
    This script creates a scheduled task named 'Atlas Performance Monitor' that runs
    every minute to collect CPU, Memory, and Disk usage and saves it to a local
    JSON file at C:\Atlas\[ComputerName].json.
#>

$ErrorActionPreference = 'Stop'

try {
    # 1. Define the command to be executed by the scheduled task
    $CommandToRun = {
        # Define paths within the script block to ensure scope
        $AtlasFolder = "C:\Atlas"
        $OutputFile = Join-Path -Path $AtlasFolder -ChildPath "$($env:COMPUTERNAME).json"

        # Create the directory if it doesn't exist
        if (-not (Test-Path -Path $AtlasFolder)) {
            New-Item -Path $AtlasFolder -ItemType Directory -Force | Out-Null
        }

        # --- Reliable Data Collection ---
        # Get CPU Usage (more reliable than Get-Counter for this context)
        $cpuInfo = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Processor | Where-Object { $_.Name -eq '_Total' }
        $cpuUsage = $cpuInfo.PercentProcessorTime

        # Get Memory Usage
        $osInfo = Get-CimInstance -ClassName Win32_OperatingSystem
        $totalMemoryGB = [math]::Round($osInfo.TotalVisibleMemorySize / 1MB, 2)
        $freeMemoryGB = [math]::Round($osInfo.FreePhysicalMemory / 1KB, 2)
        $usedMemoryGB = $totalMemoryGB - $freeMemoryGB
        
        # Get Disk Info for all fixed local disks
        $diskInfo = Get-CimInstance -ClassName Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 } | ForEach-Object {
            @{
                volume = $_.DeviceID;
                sizeGB = [math]::Round($_.Size / 1GB, 2);
                freeGB = [math]::Round($_.FreeSpace / 1GB, 2)
            }
        }

        # Assemble the data object
        $perfData = @{
            timestamp = (Get-Date).ToUniversalTime().ToString("o"); # ISO 8601 format
            cpuUsage = $cpuUsage;
            usedMemoryGB = $usedMemoryGB;
            totalMemoryGB = $totalMemoryGB;
            diskInfo = $diskInfo;
        }

        # Write data to the JSON file
        $perfData | ConvertTo-Json -Compress | Out-File -FilePath $OutputFile -Encoding utf8 -Force
    }

    # 2. Encode the command for reliable execution
    $EncodedCommand = [System.Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandToRun.ToString()))

    # 3. Define the action to run the encoded PowerShell command
    $Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-WindowStyle Hidden -EncodedCommand $EncodedCommand"

    # 4. Define the trigger to run the task every minute
    $Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 9999)

    # 5. Define the principal for the task to run as the SYSTEM account
    $Principal = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\SYSTEM' -LogonType ServiceAccount -RunLevel Highest

    # 6. Define the settings for the task
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

    # 7. Register the task, overwriting if it already exists
    $TaskName = "Atlas Performance Monitor"
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force

    # 8. Start the task immediately for the first run
    Start-ScheduledTask -TaskName $TaskName

    Write-Host "SUCCESS: Scheduled task '$TaskName' has been created and started successfully."

} catch {
    $ErrorMessage = $_.Exception.Message
    Write-Error "FAILURE: An error occurred during agent deployment. Details: $ErrorMessage"
    # Exit with a non-zero code to indicate failure to PsExec
    exit 1
}
