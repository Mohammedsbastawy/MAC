# SCRIPT TO DEPLOY THE ATLAS PERFORMANCE MONITORING AGENT
# This script creates a scheduled task to run every minute, collect performance data, and write it to a JSON file.

try {
    # 1. Define the core command block to be executed by the scheduled task.
    #    ALL logic is now self-contained within this block to avoid scope issues.
    $CommandToRun = {
        # Define paths INSIDE the command block.
        $AtlasFolder = "C:\Atlas"
        $OutputFile = Join-Path -Path $AtlasFolder -ChildPath "$($env:COMPUTERNAME).json"

        # Create the directory if it doesn't exist. This runs every time, but is safe.
        if (-not (Test-Path -Path $AtlasFolder)) {
            New-Item -Path $AtlasFolder -ItemType Directory -Force
        }

        # Performance Data Collection. Averages CPU over 2 samples to get a more stable reading.
        $cpuSample = Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 2
        $cpuUsage = $cpuSample.CounterSamples | Measure-Object -Property CookedValue -Average | Select-Object -ExpandProperty Average
        
        $totalMemoryGB = (Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory / 1GB
        $usedMemoryGB = $totalMemoryGB - ((Get-Counter -Counter "\Memory\Available MBytes").CounterSamples.CookedValue / 1024)

        # Construct the JSON object with two decimal places for cleanliness.
        $perfData = @{
            timestamp = (Get-Date).ToUniversalTime().ToString('o');
            cpuUsage = [math]::Round($cpuUsage, 2);
            totalMemoryGB = [math]::Round($totalMemoryGB, 2);
            usedMemoryGB = [math]::Round($usedMemoryGB, 2);
        }

        # Convert to JSON and write to the file.
        $perfData | ConvertTo-Json -Compress | Out-File -FilePath $OutputFile -Encoding utf8 -Force
    }

    # 2. Encode the self-contained command for reliable execution.
    $EncodedCommand = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($CommandToRun.ToString()))

    # 3. Define the action for the scheduled task.
    #    This runs powershell.exe and passes the entire logic block as an encoded command.
    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-EncodedCommand $EncodedCommand"

    # 4. Define the trigger for the task to run every minute.
    $Trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 1) -Once -At (Get-Date)

    # 5. Define the principal for the task to run as the SYSTEM account.
    $Principal = New-ScheduledTaskPrincipal -GroupId "BUILTIN\Administrators" -RunLevel Highest

    # 6. Define the settings for the task.
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

    # 7. Register the scheduled task, overwriting it if it already exists.
    Register-ScheduledTask -TaskName "Atlas Performance Monitor" -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force

    Write-Host "SUCCESS: Atlas agent (Scheduled Task 'Atlas Performance Monitor') has been successfully created or updated."

} catch {
    Write-Error "FAILURE: An error occurred during agent deployment. Details: $($_.Exception.Message)"
    exit 1
}
