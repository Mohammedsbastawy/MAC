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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type LogoFit = "contain" | "cover";

export default function SettingsPage() {
    const [logoUrl, setLogoUrl] = React.useState("");
    const [logoFit, setLogoFit] = React.useState<LogoFit>("cover");
    const [currentLogo, setCurrentLogo] = React.useState<string | null>("");
    const [currentLogoFit, setCurrentLogoFit] = React.useState<LogoFit>("cover");
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        // Load the saved settings from localStorage on component mount
        const savedLogo = localStorage.getItem("customLogoUrl");
        if (savedLogo) {
            setLogoUrl(savedLogo);
            setCurrentLogo(savedLogo);
        }
        const savedFit = localStorage.getItem("customLogoFit") as LogoFit;
        if (savedFit) {
            setLogoFit(savedFit);
            setCurrentLogoFit(savedFit);
        }
    }, []);

    const handleSave = () => {
        try {
            if (logoUrl) {
                localStorage.setItem("customLogoUrl", logoUrl);
            } else {
                localStorage.removeItem("customLogoUrl");
            }
            localStorage.setItem("customLogoFit", logoFit);

            // Manually dispatch a storage event to trigger update in other components
            window.dispatchEvent(new Event('storage'));
            toast({
                title: "Settings Saved",
                description: "Your custom logo has been updated.",
            });
            setCurrentLogo(logoUrl);
            setCurrentLogoFit(logoFit);
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
        localStorage.removeItem("customLogoFit");
        window.dispatchEvent(new Event('storage'));
        setLogoUrl("");
        setLogoFit("cover");
        setCurrentLogo(null);
        setCurrentLogoFit("cover");
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
            Change the application logo. Upload an image or enter a URL, and choose how it fits.
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
                        <Label>Logo Fit (Dimensions)</Label>
                         <RadioGroup
                            value={logoFit}
                            onValueChange={(value: LogoFit) => setLogoFit(value)}
                            className="flex items-center gap-6 pt-2"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="contain" id="fit-contain" />
                                <Label htmlFor="fit-contain" className="cursor-pointer">
                                    Contain (Show full image)
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="cover" id="fit-cover" />
                                <Label htmlFor="fit-cover" className="cursor-pointer">
                                    Cover (Fill space)
                                </Label>
                            </div>
                        </RadioGroup>
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
                    <div className="w-32 h-32 mx-auto flex items-center justify-center bg-muted/50 rounded-lg p-2">
                        <Logo className="w-full h-full" />
                    </div>
                </div>
                 <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">New Preview</h4>
                    <div className="w-32 h-32 mx-auto flex items-center justify-center bg-muted/50 rounded-lg p-2">
                        {logoUrl ? (
                            <img 
                                src={logoUrl} 
                                alt="New logo preview" 
                                className="max-w-full max-h-full"
                                style={{ objectFit: logoFit }}
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
