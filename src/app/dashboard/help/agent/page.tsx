import {
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Zap, HardDrive, ShieldAlert } from "lucide-react";

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="mt-2 rounded-md bg-muted p-4 text-sm">
        <code className="text-foreground font-mono">{children}</code>
    </pre>
);

const Step: React.FC<{ number: number, title: string, children: React.ReactNode }> = ({ number, title, children }) => (
    <div className="flex gap-4">
        <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                {number}
            </div>
            <div className="flex-1 w-px bg-border my-2" />
        </div>
        <div>
            <h4 className="font-semibold text-lg">{title}</h4>
            <div className="text-muted-foreground mt-1 space-y-2">{children}</div>
        </div>
    </div>
)

export default function AgentDeploymentPage() {
    const agentScript = `
# Agent Script to be deployed on client machines
# This script gathers performance data and saves it to a central JSON file.

# Ensure the script stops on errors
$ErrorActionPreference = "Stop"

try {
    # 1. Gather Performance Data
    $cpuCounter = Get-Counter -Counter "\\Processor(_Total)\\% Processor Time" -SampleInterval 1
    $cpuUsage = $cpuCounter.CounterSamples.CookedValue

    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    $totalMemoryGB = $os.TotalVisibleMemorySize / 1024 / 1024
    $freeMemoryGB = $os.FreePhysicalMemory / 1024 / 1024
    $usedMemoryGB = $totalMemoryGB - $freeMemoryGB

    $disks = Get-Volume | Where-Object { $_.DriveType -eq 'Fixed' -and $_.DriveLetter } | ForEach-Object {
        [pscustomobject]@{
            volume = $_.DriveLetter;
            sizeGB = [math]::Round($_.Size / 1GB, 2);
            freeGB = [math]::Round($_.SizeRemaining / 1GB, 2);
        }
    }

    # 2. Create the Data Object
    $data = [PSCustomObject]@{
        cpuUsage      = [math]::Round($cpuUsage, 2)
        totalMemoryGB = [math]::Round($totalMemoryGB, 2)
        usedMemoryGB  = [math]::Round($usedMemoryGB, 2)
        diskInfo      = $disks
        timestamp     = (Get-Date).ToUniversalTime().ToString("o") # ISO 8601 format
    }

    # 3. Define the path and save the file
    # IMPORTANT: Replace with your actual server and share name
    $sharePath = "\\\\YOUR_SERVER_NAME\\monitoring_data"
    $filePath = Join-Path -Path $sharePath -ChildPath "$($env:COMPUTERNAME).json"

    # Convert to JSON and save to the shared path
    $data | ConvertTo-Json -Depth 4 -Compress | Set-Content -Path $filePath -Encoding UTF8 -Force

} catch {
    # Optional: You can add error logging to a local file on the client
    # for troubleshooting purposes.
    # Example:
    # $logPath = "C:\\Temp\\MonitorAgentErrors.log"
    # $errorMessage = "[$((Get-Date).ToString('o'))] Error: $($_.Exception.Message)"
    # Add-Content -Path $logPath -Value $errorMessage
}
`.trim();

    return (
        <div className="container mx-auto max-w-5xl space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Zap /> Monitoring Agent Deployment Guide
                    </CardTitle>
                    <CardDescription>
                        Follow these steps to deploy the monitoring agent across your network using Group Policy. This is the recommended, most reliable, and scalable method for monitoring.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Step number={1} title="Create a Shared Folder">
                        <p>On your server (the machine running this application), create a folder. For example, <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">C:\monitoring_data</code>.</p>
                        <p>Right-click the folder, go to Properties &rarr; Sharing &rarr; Advanced Sharing.</p>
                        <p>Share the folder and name it (e.g., <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">monitoring_data</code>). Click on "Permissions".</p>
                        <p>Grant the **"Domain Computers"** group **Full Control** permissions. This is crucial as it allows the computer accounts themselves to write to this share.</p>
                        <img src="https://i.imgur.com/Bkc3y1k.png" alt="SMB Share Permissions" className="mt-2 rounded-lg border shadow-md" />
                    </Step>

                    <Step number={2} title="Save the Agent Script">
                        <p>Copy the PowerShell script below and save it as a file named <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">monitor_agent.ps1</code>.</p>
                        <Alert>
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>Crucial Edit</AlertTitle>
                            <AlertDescription>
                                Open the script and **replace** <code className="font-mono bg-destructive/20 text-destructive px-1 py-0.5 rounded-sm">\\\\YOUR_SERVER_NAME\\monitoring_data</code> with the actual network path to the shared folder you created.
                            </AlertDescription>
                        </Alert>
                        <CodeBlock>{agentScript}</CodeBlock>
                        <p>Place this <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">monitor_agent.ps1</code> file in a location accessible by domain controllers, such as the NETLOGON share.</p>
                    </Step>

                     <Step number={3} title="Create and Configure a Group Policy Object (GPO)">
                        <p>Open **Group Policy Management** on your domain controller.</p>
                        <p>Create a new GPO and link it to the Organizational Unit (OU) that contains the computers you want to monitor.</p>
                        <p>Edit the GPO and navigate to:</p>
                         <CodeBlock>Computer Configuration &rarr; Preferences &rarr; Control Panel Settings &rarr; Scheduled Tasks</CodeBlock>
                        <p>Right-click and select New &rarr; **Scheduled Task (At least Windows 7)**.</p>
                    </Step>

                     <Step number={4} title="Configure the Scheduled Task">
                        <p>Configure the task with the following settings:</p>
                        <ul className="list-disc pl-6 space-y-2">
                           <li>**General Tab:**
                                <ul>
                                    <li>Name: <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">System Monitor Agent</code></li>
                                    <li>When running the task, use the following user account: Click "Change User or Group..." and type <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">NT AUTHORITY\System</code>. The SYSTEM account has the necessary local permissions.</li>
                                     <li>Run whether user is logged on or not.</li>
                                     <li>Run with highest privileges.</li>
                                </ul>
                           </li>
                           <li>**Triggers Tab:**
                                <ul>
                                    <li>Click "New...".</li>
                                    <li>Begin the task: "On a schedule".</li>
                                    <li>Settings: "Daily".</li>
                                    <li>Advanced settings: Check "Repeat task every:" and set it to **1 minute**. For a duration of: **Indefinitely**.</li>
                                </ul>
                           </li>
                            <li>**Actions Tab:**
                                <ul>
                                    <li>Click "New...".</li>
                                    <li>Action: "Start a program".</li>
                                    <li>Program/script: <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">powershell.exe</code></li>
                                     <li>Add arguments (optional): <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">-ExecutionPolicy Bypass -File "\\YOUR_DOMAIN\NETLOGON\monitor_agent.ps1"</code></li>
                                </ul>
                           </li>
                        </ul>
                         <img src="https://i.imgur.com/kF3b0tY.png" alt="GPO Scheduled Task Configuration" className="mt-2 rounded-lg border shadow-md" />
                    </Step>
                     <Step number={5} title="Final Step">
                        <p>Once the GPO is applied, the target computers will automatically create this scheduled task on their next policy update. The task will run the script every minute, sending fresh performance data to your shared folder.</p>
                        <p>The monitoring page will now read from these files, resulting in a much faster and more reliable experience.</p>
                     </Step>
                </CardContent>
            </Card>
        </div>
    );
}
