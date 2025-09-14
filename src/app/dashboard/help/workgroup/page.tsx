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
import { Lan, ShieldAlert } from "lucide-react";

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="mt-2 rounded-md bg-muted p-4">
        <code className="text-sm text-muted-foreground">{children}</code>
    </pre>
);

export default function WorkgroupHelpPage() {
    return (
        <div className="container mx-auto max-w-5xl space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Lan /> Managing Non-Domain (Workgroup) Machines
                    </CardTitle>
                    <CardDescription>
                        To manage computers that are not part of your Active Directory domain, you must run this PowerShell script on each target machine. This script configures WinRM to trust your control panel machine.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Run with Administrator Privileges</AlertTitle>
                        <AlertDescription>
                            You must open PowerShell as an Administrator on the target workgroup machine to run this script successfully.
                        </AlertDescription>
                    </Alert>
                    <div>
                        <h4 className="font-semibold text-lg">Configuration Script</h4>
                        <p className="text-muted-foreground mt-1">
                            Copy the script below. Before running it, you **must** replace <code className="font-mono bg-destructive/20 text-destructive px-1 py-0.5 rounded-sm">"YOUR_CONTROL_PANEL_IP"</code> with the actual IP address of the machine where this control panel is running.
                        </p>
                        <CodeBlock>
{`# 1. Enable WinRM and configure firewall
winrm quickconfig -q

# 2. IMPORTANT: Set the IP of your control panel machine as a trusted host
#    Replace "YOUR_CONTROL_PANEL_IP" with the actual IP address.
$ControlPanelIP = "YOUR_CONTROL_PANEL_IP"
Set-Item wsman:\\localhost\\Client\\TrustedHosts -Value $ControlPanelIP -Force

# 3. Ensure the WinRM service is running and set to start automatically
Set-Service -Name WinRM -StartupType Automatic

# 4. Final verification
Write-Host "WinRM has been configured." -ForegroundColor Green
Get-Item wsman:\\localhost\\Client\\TrustedHosts`}
                        </CodeBlock>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
