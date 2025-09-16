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
import { Zap, ShieldAlert, FileText } from "lucide-react";

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="mt-2 rounded-md bg-muted p-4 text-sm font-mono text-foreground">
        <code>{children}</code>
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
# Universal PowerShell Script to Install and Configure SNMP Service
# Compatible with modern Windows Client and Server editions.

param (
    [string]$TrapDestination
)

# --- Configuration ---
$CommunityString = "public"
if (-not $TrapDestination) {
    Write-Warning "Trap destination IP not provided. Defaulting to localhost."
    $TrapDestination = "127.0.0.1"
}

try {
    # Step 1: Install SNMP Service using DISM (most reliable method)
    Write-Host "Step 1: Installing SNMP Service..." -ForegroundColor Yellow
    $snmpFeature = Get-WindowsOptionalFeature -Online -FeatureName "SNMP"
    if ($snmpFeature.State -ne 'Enabled') {
        Write-Host "SNMP feature is not installed. Installing via DISM..."
        dism.exe /online /enable-feature /featurename:SNMP /NoRestart
        Write-Host "SNMP feature installed successfully." -ForegroundColor Green
    } else {
        Write-Host "SNMP Service is already installed." -ForegroundColor Green
    }

    # Step 2: Configure and Start Services
    Write-Host "Step 2: Configuring and starting services..." -ForegroundColor Yellow
    Set-Service -Name "SNMP" -StartupType Automatic
    Start-Service -Name "SNMP"
    Set-Service -Name "SNMPTrap" -StartupType Automatic
    Start-Service -Name "SNMPTrap"
    Write-Host "SNMP and SNMPTrap services are set to Automatic and started." -ForegroundColor Green

    # Step 3: Configure Registry for Community String and Trap Destination
    Write-Host "Step 3: Configuring SNMP registry settings..." -ForegroundColor Yellow
    
    # Set Community String
    $regPathCommunities = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\ValidCommunities"
    if (-not (Test-Path $regPathCommunities)) { New-Item -Path $regPathCommunities -Force | Out-Null }
    Set-ItemProperty -Path $regPathCommunities -Name $CommunityString -Value 4 -Type DWORD -Force
    Write-Host " - Community string '$CommunityString' set to ReadOnly."

    # Set Trap Destination
    $trapConfigPath = "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\TrapConfiguration\\$CommunityString"
    if (-not (Test-Path $trapConfigPath)) { New-Item -Path $trapConfigPath -Force | Out-Null }
    Set-ItemProperty -Path $trapConfigPath -Name "1" -Value $TrapDestination -Type String -Force
    Write-Host " - Trap destination set to '$TrapDestination'."

    # Step 4: Configure Windows Firewall
    Write-Host "Step 4: Configuring Windows Firewall..." -ForegroundColor Yellow
    $ruleName = "SNMP Traps (UDP-Out)"
    $firewallRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $firewallRule) {
        Write-Host " - Firewall rule '$ruleName' not found. Creating..."
        New-NetFirewallRule -DisplayName $ruleName -Direction Outbound -Protocol UDP -RemotePort 162 -Action Allow
    } else {
        Write-Host " - Firewall rule '$ruleName' already exists."
        $firewallRule | Enable-NetFirewallRule
    }
    Write-Host "Firewall configured." -ForegroundColor Green

    # Step 5: Send a test trap to confirm configuration
    Write-Host "Step 5: Sending a test trap to confirm configuration..." -ForegroundColor Yellow
    # This module is installed with the SNMP feature
    Import-Module SNMPScripting
    Send-SnmpTrap -Community $CommunityString -Agent $env:COMPUTERNAME -Destination $TrapDestination -Generic 6 -Specific 1
    
    Write-Host "SNMP configuration completed successfully." -ForegroundColor Green

} catch {
    Write-Error "An error occurred during SNMP configuration: $_"
    exit 1
}
`.trim();

    return (
        <div className="container mx-auto max-w-5xl space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Zap /> Automatic SNMP Deployment Script
                    </CardTitle>
                    <CardDescription>
                        This is the PowerShell script used by the "Configure SNMP" button. You can use it for manual deployment or troubleshooting.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    <Step number={1} title="Understand the Script">
                        <p>The script below is designed to be run on a target machine. It performs all necessary steps to install and configure SNMP to send data to your control panel server.</p>
                        <p className="font-semibold mt-2">Key Actions:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                            <li>Installs the SNMP Service feature using DISM if it's not already present.</li>
                            <li>Sets the SNMP and SNMP Trap services to start automatically and ensures they are running.</li>
                            <li>Configures the "public" community string.</li>
                            <li>Sets the trap destination to your server's IP address.</li>
                            <li>Creates a firewall rule to allow outgoing SNMP trap messages on UDP port 162.</li>
                             <li>Sends a test trap to verify the configuration.</li>
                        </ul>
                    </Step>

                     <Step number={2} title="Review the Script">
                        <p>The <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">$TrapDestination</code> parameter is automatically replaced with your server's IP when you use the button in the application.</p>
                         <Alert className="mt-2">
                             <FileText className="h-4 w-4" />
                            <AlertTitle>Full Script Content</AlertTitle>
                            <AlertDescription>
                                This script is a robust, all-in-one solution for enabling SNMP monitoring.
                            </AlertDescription>
                        </Alert>
                         <CodeBlock>{agentScript}</CodeBlock>
                    </Step>

                     <Step number={3} title="Manual Deployment (Optional)">
                        <p>If you need to deploy this on a machine that cannot be reached by the application, you can:</p>
                         <ul className="list-disc pl-5 mt-1 space-y-1">
                            <li>Save the script above as a <code className="font-mono bg-muted px-1 py-0.5 rounded-sm">.ps1</code> file.</li>
                            <li>Run it on the target machine with Administrator privileges.</li>
                            <li>You will need to manually provide the IP of your control panel server:</li>
                        </ul>
                         <CodeBlock>
                            .\\YourScript.ps1 -TrapDestination "YOUR_SERVER_IP"
                        </CodeBlock>
                    </Step>
                </CardContent>
            </Card>
        </div>
    );
}
