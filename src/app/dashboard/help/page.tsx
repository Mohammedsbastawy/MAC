import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DownloadCloud, ShieldAlert, ShieldCheck, Siren, Network, Search, UserCog, Zap, Wrench, ArrowRight } from "lucide-react"
import Link from "next/link"

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <pre className="mt-2 rounded-md bg-muted p-4">
        <code className="text-sm text-muted-foreground">{children}</code>
    </pre>
)

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
            <div className="text-muted-foreground mt-1">{children}</div>
        </div>
    </div>
)

export default function HelpPage() {
    return (
        <div className="container mx-auto max-w-5xl space-y-8">
            <div className="space-y-2 text-center">
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Prerequisites & Troubleshooting</h1>
                <p className="text-muted-foreground">
                    Follow these guides to ensure the application runs smoothly.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Network /> Managing Workgroup (Non-Domain) Machines
                    </CardTitle>
                    <CardDescription>
                        To manage computers that are not part of your Active Directory domain, a special PowerShell script must be run on each target machine. This page explains how to do it.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <p className="text-muted-foreground">
                        This process involves configuring WinRM on the workgroup computer to trust the IP address of this control panel, allowing for secure remote management without a domain trust relationship.
                    </p>
                    <Button asChild className="mt-4">
                        <Link href="/dashboard/help/workgroup">
                            Go to Workgroup Setup Guide <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Search /> Prerequisite 1: Masscan for Network Discovery
                    </CardTitle>
                    <CardDescription>
                       This application uses Masscan for extremely fast and accurate device discovery. This requires the `masscan.exe` binary.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h4 className="font-semibold text-lg">Download Masscan Executable</h4>
                        <p className="text-muted-foreground mt-1">You need to place the Masscan executable (`masscan.exe`) in the application's `Tools/bin` directory.</p>
                         <a href="https://github.com/robertdavidgraham/masscan/releases" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-3">
                            Download Masscan from GitHub Releases <DownloadCloud className="ml-2 h-4 w-4" />
                         </a>
                         <Alert className="mt-4">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>Important Setup Instructions</AlertTitle>
                            <AlertDescription>
                               1. On the GitHub releases page, find the latest version and look for a file named something like `masscan-2.0.5-win.zip`. This is the correct file.<br/>
                               2. Unzip the downloaded file.<br/>
                               3. Find the `bin` directory inside the unzipped folder. Inside `bin`, you will find `masscan.exe`.<br/>
                               4. Create a folder named `bin` inside the `Tools` directory of this project.<br/>
                               5. Copy `masscan.exe` and paste it into the `Tools/bin` directory.
                            </AlertDescription>
                        </Alert>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Zap /> Prerequisite 2: Enable WinRM via Group Policy
                    </CardTitle>
                    <CardDescription>
                        For fast and reliable remote file browsing, WinRM must be enabled on all target machines. The best way to do this in a domain environment is with a GPO.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="flex flex-col gap-2">
                        <Step number={1} title="Create or Edit a GPO">
                           In the <span className="font-mono bg-muted px-1 py-0.5 rounded-sm">Group Policy Management</span> console, create a new GPO (e.g., "Enable WinRM") and link it to the OU containing your computers.
                        </Step>
                        <Step number={2} title="Enable WinRM Service">
                            <p>Navigate to:</p>
                            <CodeBlock>Computer Configuration → Policies → Administrative Templates → Windows Components → Windows Remote Management (WinRM) → WinRM Service</CodeBlock>
                             <p className="mt-2">Find and enable the policy **Allow remote server management through WinRM**. Set the IPv4 and IPv6 filter to `*` to allow connections from any source on your network.</p>
                        </Step>
                        <Step number={3} title="Set Service to Auto-Start">
                           <p>To ensure the service is always running, navigate to:</p>
                           <CodeBlock>Computer Configuration → Policies → Windows Settings → Security Settings → System Services</CodeBlock>
                           <p className="mt-2">Find **Windows Remote Management (WS-Management)**, define the policy, and set its startup mode to **Automatic**.</p>
                        </Step>
                        <Step number={4} title="Configure Firewall Rule">
                            <p>In the same GPO, navigate to:</p>
                            <CodeBlock>Computer Configuration → Policies → Windows Settings → Security Settings → Windows Defender Firewall with Advanced Security → Inbound Rules</CodeBlock>
                             <p className="mt-2">Right-click and select "New Rule...". Choose **Predefined** and select **Windows Remote Management** from the list. Ensure the rule for the "Domain" profile is checked and that the action is "Allow the connection".</p>
                             <img src="https://i.imgur.com/8Qq9Y1W.png" alt="Group Policy Editor showing the predefined firewall rule for WinRM" className="mt-4 rounded-lg border shadow-md" />
                        </Step>
                         <Step number={5} title="Apply the Policy">
                            <p>Link the GPO to the appropriate OU. The policy will apply at the next refresh interval, or you can force it on a client by running:</p>
                            <CodeBlock>gpupdate /force</CodeBlock>
                        </Step>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <ShieldCheck /> Prerequisite 3: Enabling Remote Registry
                    </CardTitle>
                    <CardDescription>
                        This service is essential for PsInfo and other tools to gather system information.
                        The recommended way to enable it for multiple computers is via Group Policy.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col gap-2">
                        <Step number={1} title="Open Group Policy Management">
                            On a domain controller, open the <span className="font-mono bg-muted px-1 py-0.5 rounded-sm">Group Policy Management</span> console.
                        </Step>
                        <Step number={2} title="Create or Edit a GPO">
                            Create a new Group Policy Object (GPO) or edit an existing one that is linked to the Organizational Unit (OU) containing the target computers.
                        </Step>
                         <Step number={3} title="Navigate to System Services">
                            <p>In the Group Policy editor, go to:</p>
                            <CodeBlock>Computer Configuration &rarr; Policies &rarr; Windows Settings &rarr; Security Settings &rarr; System Services</CodeBlock>
                        </Step>
                         <Step number={4} title="Configure Remote Registry Service">
                            <p>Find **Remote Registry** in the list of services.</p>
                            <p className="mt-2">Double-click it, check **Define this policy setting**, and set the service startup mode to **Automatic**.</p>
                             <img src="https://i.imgur.com/kC5oA3g.png" alt="Group Policy Editor showing Remote Registry properties" className="mt-4 rounded-lg border shadow-md" />
                        </Step>
                         <Step number={5} title="Apply the Policy">
                            <p>Close the policy editor. The policy will apply to computers at their next refresh interval. To force an immediate update, you can run this command on a target client:</p>
                            <CodeBlock>gpupdate /force</CodeBlock>
                        </Step>
                    </div>
                </CardContent>
            </Card>
            
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <UserCog /> Prerequisite 4: User Rights Assignment
                    </CardTitle>
                    <CardDescription>
                        Ensure the administrator account has the correct permissions to connect remotely. This is a critical security step.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col gap-2">
                         <Step number={1} title="Navigate to User Rights Assignment">
                            <p>In the same GPO from the previous step, go to:</p>
                            <CodeBlock>Computer Configuration &rarr; Policies &rarr; Windows Settings &rarr; Security Settings &rarr; Local Policies &rarr; User Rights Assignment</CodeBlock>
                        </Step>
                        <Step number={2} title="Configure 'Allow' Policies">
                             <p>Edit the following policies to **include** your administrator user or an appropriate admin group (e.g., "Domain Admins"):</p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li><strong>Allow log on locally</strong></li>
                                <li><strong>Log on as a service</strong></li>
                                <li><strong>Allow log on through Remote Desktop Services</strong> (if you intend to use RDP alongside this tool)</li>
                            </ul>
                        </Step>
                         <Step number={3} title="Configure 'Deny' Policies">
                            <p>Crucially, ensure the same user or group is **NOT** present in the following "Deny" policies, as these policies override the "Allow" policies:</p>
                            <ul className="list-disc pl-6 space-y-2 mt-2">
                                <li><strong>Deny log on locally</strong></li>
                                <li><strong>Deny log on as a service</strong></li>
                                <li><strong>Deny log on through Remote Desktop Services</strong></li>
                            </ul>
                        </Step>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                     <CardTitle className="flex items-center gap-2 text-2xl">
                        <Siren /> Prerequisite 5: Firewall Configuration
                    </CardTitle>
                    <CardDescription>
                        Firewalls can block the communication needed for PsTools. You must ensure the required ports are open between this control panel and the target devices.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Alert>
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Required Ports for PsTools</AlertTitle>
                        <AlertDescription>
                            For tools like PsInfo, PsList, etc., you must allow inbound traffic on the target machines for **RPC (TCP port 135)** and **SMB (TCP port 445)**.
                        </AlertDescription>
                    </Alert>
                    
                    <Alert className="mt-4">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Required Port for WinRM</AlertTitle>
                        <AlertDescription>
                            For the fast File Browser, you must allow inbound traffic on **HTTP (TCP port 5985)**. The GPO rule from Prerequisite 2 should handle this.
                        </AlertDescription>
                    </Alert>

                    <Accordion type="single" collapsible className="w-full mt-6">
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="text-lg font-medium">Windows Firewall</AccordionTrigger>
                            <AccordionContent className="space-y-2 text-base">
                                <p>You can enable the necessary rules via Group Policy for consistency:</p>
                                <p>1. Navigate to: <CodeBlock>Computer Configuration &rarr; Policies &rarr; Windows Settings &rarr; Security Settings &rarr; Windows Firewall with Advanced Security</CodeBlock></p>
                                <p>2. Create a new **Inbound Rule**.</p>
                                <p>3. For PsTools, select **Predefined** and choose **File and Printer Sharing** from the list. Ensure rules for `(RPC)` and `(SMB-In)` are checked.</p>
                                 <p>4. For WinRM, select **Predefined** and choose **Windows Remote Management**. This should be handled by the GPO in Prerequisite 2, but it's good to verify.</p>
                                <p>5. Select **Allow the connection** and finish the wizard.</p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                            <AccordionTrigger className="text-lg font-medium">pfSense Firewall</AccordionTrigger>
                            <AccordionContent className="space-y-2 text-base">
                               <p>1. Go to **Firewall &rarr; Rules**.</p>
                               <p>2. Select the interface where the traffic will originate (e.g., LAN).</p>
                               <p>3. Click **Add** to create a new rule.</p>
                               <p>4. Configure the rule:</p>
                               <ul className="list-disc pl-6 space-y-1">
                                   <li>**Action:** Pass</li>
                                   <li>**Interface:** LAN (or your internal network)</li>
                                   <li>**Protocol:** TCP</li>
                                   <li>**Source:** The IP address of the Dominion Control Panel machine.</li>
                                   <li>**Destination:** The network segment of your target machines.</li>
                                   <li>**Destination Port Range:** Create an alias for ports **135, 445, 5985** or enter them manually.</li>
                               </ul>
                               <p>5. Save and apply changes.</p>
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-3">
                            <AccordionTrigger className="text-lg font-medium">FortiGate Firewall</AccordionTrigger>
                            <AccordionContent className="space-y-2 text-base">
                               <p>1. Go to **Policy & Objects &rarr; Firewall Policy**.</p>
                               <p>2. Click **Create New**.</p>
                               <p>3. Create a policy allowing traffic from the Dominion machine to the target network segment.</p>
                               <ul className="list-disc pl-6 space-y-1">
                                    <li>**Incoming Interface:** Port connected to the Dominion machine's network.</li>
                                    <li>**Outgoing Interface:** Port connected to the target clients' network.</li>
                                    <li>**Source:** An address object for the Dominion machine's IP.</li>
                                    <li>**Destination:** An address object for the target network.</li>
                                    <li>**Service:** Create a custom service for TCP ports **135, 445, 5985**.</li>
                                    <li>**Action:** Accept.</li>
                               </ul>
                               <p>4. Ensure the policy is placed correctly in the sequence to be evaluated.</p>
                            </AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="item-4">
                            <AccordionTrigger className="text-lg font-medium">Sophos Firewall</AccordionTrigger>
                            <AccordionContent className="space-y-2 text-base">
                                <p>1. Go to **Rules and policies &rarr; Firewall rules**.</p>
                                <p>2. Click **Add firewall rule** and select **New firewall rule**.</p>
                                <p>3. Configure the rule settings:</p>
                                <ul className="list-disc pl-6 space-y-1">
                                    <li>**Source zones:** LAN (or the zone of the Dominion machine).</li>
                                    <li>**Source networks and devices:** The IP of the Dominion machine.</li>
                                    <li>**Destination zones:** LAN (or the zone of the target clients).</li>
                                    <li>**Destination networks:** The network of the target clients.</li>
                                    <li>**Services:** Create new services for TCP ports **135, 445, 5985**.</li>
                                </ul>
                                <p>4. Save the rule and ensure it's enabled.</p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <Wrench /> Prerequisite 6: Ensure Core Services (WMI & RPC) are Running
                    </CardTitle>
                    <CardDescription>
                        These core Windows services are essential for communication. If they are stopped, most remote tools will fail. You can ensure they are running via GPO.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <h4 className="font-semibold text-xl">Method 1: Group Policy Preferences (Recommended)</h4>
                    <p className="text-muted-foreground -mt-4">This is the best method to both set the service to automatic and ensure it is started.</p>
                    <div className="flex flex-col gap-2">
                        <Step number={1} title="Navigate to GPO Preferences">
                            In your GPO, go to:
                            <CodeBlock>Computer Configuration &rarr; Preferences &rarr; Control Panel Settings &rarr; Services</CodeBlock>
                        </Step>
                        <Step number={2} title="Create New Service Policy">
                            Right-click in the empty space and choose <span className="font-mono bg-muted px-1 py-0.5 rounded-sm">New &rarr; Service</span>.
                        </Step>
                        <Step number={3} title="Configure the Service">
                           <p>In the "Service name" field, enter the exact name of the service:</p>
                           <ul className="list-disc pl-6 space-y-1 mt-2">
                                <li>For WMI: <span className="font-mono bg-muted px-1 py-0.5 rounded-sm">winmgmt</span></li>
                                <li>For RPC: <span className="font-mono bg-muted px-1 py-0.5 rounded-sm">RpcSs</span></li>
                           </ul>
                           <p className="mt-2">Set the **Startup** type to **Automatic**. Then, set the **Service action** to **Start service**.</p>
                           <img src="https://i.imgur.com/uVj2i6W.png" alt="Group Policy Preferences for Services" className="mt-4 rounded-lg border shadow-md" />
                           <p className="mt-2">Repeat this for both services.</p>
                        </Step>
                    </div>
                     <h4 className="font-semibold text-xl mt-8">Method 2: System Services Policy</h4>
                     <p className="text-muted-foreground -mt-4">This method is simpler but only configures the startup type, it does not actively start the service if it's stopped.</p>
                      <div className="flex flex-col gap-2">
                        <Step number={1} title="Navigate to System Services">
                             In your GPO, go to:
                            <CodeBlock>Computer Configuration &rarr; Policies &rarr; Windows Settings &rarr; Security Settings &rarr; System Services</CodeBlock>
                        </Step>
                         <Step number={2} title="Configure Service Startup">
                            Find **Windows Management Instrumentation** (for WMI) and **Remote Procedure Call (RPC)** in the list. For each one, double-click, check "Define this policy setting", and set the startup mode to **Automatic**.
                        </Step>
                    </div>
                </CardContent>
            </Card>

        </div>
    )
}
