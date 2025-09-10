import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DownloadCloud, ShieldAlert, ShieldCheck, Siren, Network, Search, UserCog } from "lucide-react"

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
                        <ShieldCheck /> Prerequisite 2: Enabling Remote Registry
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
                        <UserCog /> Prerequisite 3: User Rights Assignment
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
                        <Siren /> Prerequisite 4: Firewall Configuration
                    </CardTitle>
                    <CardDescription>
                        Firewalls can block the communication needed for PsTools. You must ensure the required ports are open between this control panel and the target devices.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <Alert>
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Required Ports</AlertTitle>
                        <AlertDescription>
                            You must allow inbound traffic on the target machines for **RPC (TCP port 135)** and **SMB (TCP port 445)**.
                        </AlertDescription>
                    </Alert>

                    <Accordion type="single" collapsible className="w-full mt-6">
                        <AccordionItem value="item-1">
                            <AccordionTrigger className="text-lg font-medium">Windows Firewall</AccordionTrigger>
                            <AccordionContent className="space-y-2 text-base">
                                <p>You can enable the necessary rules via Group Policy for consistency:</p>
                                <p>1. Navigate to: <CodeBlock>Computer Configuration &rarr; Policies &rarr; Windows Settings &rarr; Security Settings &rarr; Windows Firewall with Advanced Security</CodeBlock></p>
                                <p>2. Create a new **Inbound Rule**.</p>
                                <p>3. Select **Predefined** and choose **File and Printer Sharing** from the list. Click Next.</p>
                                <p>4. Ensure the rules for `(RPC)` and `(SMB-In)` are checked. Click Next.</p>
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
                                   <li>**Destination Port Range:** Create an alias for ports **135, 445** or enter them manually.</li>
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
                                    <li>**Service:** Create a custom service for TCP ports **135** and **445**.</li>
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
                                    <li>**Services:** Create new services for TCP port **135** and TCP port **445**.</li>
                                </ul>
                                <p>4. Save the rule and ensure it's enabled.</p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    )
}
