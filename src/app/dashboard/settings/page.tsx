"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { UploadCloud, Image as ImageIcon } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

export default function SettingsPage() {
    const [logoUrl, setLogoUrl] = React.useState("");
    const [logoSize, setLogoSize] = React.useState(100);
    const [currentLogo, setCurrentLogo] = React.useState<string | null>("");
    const [currentLogoSize, setCurrentLogoSize] = React.useState(100);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        // Load the saved settings from localStorage on component mount
        const savedLogo = localStorage.getItem("customLogoUrl");
        if (savedLogo) {
            setLogoUrl(savedLogo);
            setCurrentLogo(savedLogo);
        }
        const savedSize = localStorage.getItem("customLogoSize");
        if (savedSize) {
            const size = parseInt(savedSize, 10);
            setLogoSize(size);
            setCurrentLogoSize(size);
        }
    }, []);

    const handleSave = () => {
        try {
            if (logoUrl) {
                localStorage.setItem("customLogoUrl", logoUrl);
            } else {
                localStorage.removeItem("customLogoUrl");
            }
            localStorage.setItem("customLogoSize", logoSize.toString());

            // Manually dispatch a storage event to trigger update in other components
            window.dispatchEvent(new Event('storage'));
            toast({
                title: "Settings Saved",
                description: "Your custom logo has been updated.",
            });
            setCurrentLogo(logoUrl);
            setCurrentLogoSize(logoSize);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error Saving",
                description: "Could not save settings to local storage. Your browser might be in private mode.",
            });
        }
    };

    const handleRevert = () => {
        localStorage.removeItem("customLogoUrl");
        localStorage.removeItem("customLogoSize");
        window.dispatchEvent(new Event('storage'));
        setLogoUrl("");
        setLogoSize(100);
        setCurrentLogo(null);
        setCurrentLogoSize(100);
        toast({
            title: "Logo Reverted",
            description: "The logo has been reverted to the default.",
        });
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setLogoUrl(result);
                 toast({
                    title: "Image Ready",
                    description: "Image loaded successfully. Click 'Save' to apply it.",
                });
            };
            reader.onerror = () => {
                 toast({
                    variant: "destructive",
                    title: "Error Reading File",
                    description: "There was an issue reading the selected file.",
                });
            }
            reader.readAsDataURL(file);
        }
    };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Customize the appearance and behavior of the application.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logo Settings</CardTitle>
          <CardDescription>
            Change the application logo. Upload an image or enter a URL, and adjust its size.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="logo-url">Logo Image URL or Data URI</Label>
                        <Input
                            id="logo-url"
                            placeholder="https://example.com/logo.png or data:image/..."
                            value={logoUrl}
                            onChange={(e) => setLogoUrl(e.target.value)}
                        />
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileChange}
                            className="hidden" 
                            accept="image/png, image/jpeg, image/gif, image/svg+xml"
                        />
                    </div>
                     <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <Label>Logo Size</Label>
                            <span className="text-sm text-muted-foreground font-mono">{logoSize}%</span>
                        </div>
                         <Slider
                            value={[logoSize]}
                            onValueChange={(value) => setLogoSize(value[0])}
                            min={50}
                            max={150}
                            step={5}
                            />
                    </div>
                </div>

                 <div className="flex flex-col gap-2 pt-2 md:pt-0">
                    <Button onClick={handleSave} className="w-full md:w-auto">Save Changes</Button>
                    <Button variant="outline" onClick={handleUploadClick} className="w-full md:w-auto">
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Upload Image
                    </Button>
                    <Button variant="destructive" onClick={handleRevert} disabled={!currentLogo} className="w-full md:w-auto">
                        Revert to Default
                    </Button>
                </div>
           </div>

           <Separator className="my-6"/>

            <div className="grid grid-cols-2 gap-4 text-center">
                 <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Current Logo</h4>
                    <div className="w-32 h-32 mx-auto flex items-center justify-center bg-muted/50 rounded-lg p-2 overflow-hidden">
                        <Logo className="w-full h-full" />
                    </div>
                </div>
                 <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">New Preview</h4>
                    <div className="w-32 h-32 mx-auto flex items-center justify-center bg-muted/50 rounded-lg p-2 overflow-hidden">
                        {logoUrl ? (
                            <img 
                                src={logoUrl} 
                                alt="New logo preview" 
                                className="max-w-full max-h-full transition-transform duration-200"
                                style={{ 
                                    transform: `scale(${logoSize / 100})`,
                                    objectFit: 'contain'
                                }}
                            />
                        ) : (
                            <div className="text-muted-foreground flex flex-col items-center">
                                <ImageIcon className="h-8 w-8" />
                                <span className="text-xs mt-1">No URL or image</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
