
"use client";

import * as React from "react";
import Cropper from "react-easy-crop";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { UploadCloud, Image as ImageIcon, Crop, ZoomIn, ZoomOut } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Area } from "react-easy-crop";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


/**
 * Creates a cropped image.
 * @param {string} imageSrc - The source of the image to crop.
 * @param {Area} pixelCrop - The pixel crop area.
 * @returns {Promise<string>} - A promise that resolves with the cropped image as a base64 string.
 */
const getCroppedImg = (imageSrc: string, pixelCrop: Area): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = imageSrc;
        image.crossOrigin = 'anonymous'; // Handle CORS for external images if needed
        image.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                return reject(new Error("Failed to get canvas context"));
            }

            canvas.width = pixelCrop.width;
            canvas.height = pixelCrop.height;

            ctx.drawImage(
                image,
                pixelCrop.x,
                pixelCrop.y,
                pixelCrop.width,
                pixelCrop.height,
                0,
                0,
                pixelCrop.width,
                pixelCrop.height
            );
            
            // Get the data URL of the cropped image
            resolve(canvas.toDataURL("image/png"));
        };
        image.onerror = (error) => reject(error);
    });
};


const ImageCropperDialog: React.FC<{
    image: string | null;
    onClose: () => void;
    onCropComplete: (croppedImage: string) => void;
}> = ({ image, onClose, onCropComplete }) => {
    const [crop, setCrop] = React.useState({ x: 0, y: 0 });
    const [zoom, setZoom] = React.useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);

    const handleCropComplete = React.useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCrop = async () => {
        if (!image || !croppedAreaPixels) return;
        try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels);
            onCropComplete(croppedImage);
        } catch (e) {
            console.error(e);
            toast({
                variant: "destructive",
                title: "Cropping Failed",
                description: "Could not crop the image. Please try again.",
            });
        }
    };

    if (!image) return null;

    return (
        <Dialog open={!!image} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Crop /> Crop your new logo</DialogTitle>
                </DialogHeader>
                <div className="relative h-80 w-full bg-muted mt-4">
                    <Cropper
                        image={image}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={handleCropComplete}
                    />
                </div>
                <div className="flex items-center gap-4 mt-4">
                    <ZoomOut />
                    <Slider
                        value={[zoom]}
                        onValueChange={(value) => setZoom(value[0])}
                        min={1}
                        max={3}
                        step={0.1}
                    />
                    <ZoomIn />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleCrop}>Crop and Use Image</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function SettingsPage() {
    const [logoPreviewUrl, setLogoPreviewUrl] = React.useState("");
    const [currentLogo, setCurrentLogo] = React.useState<string | null>("");
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [imageToCrop, setImageToCrop] = React.useState<string | null>(null);
    const [logoFit, setLogoFit] = React.useState<'contain' | 'cover'>('contain');

    React.useEffect(() => {
        const savedLogo = localStorage.getItem("customLogoUrl");
        const savedFit = localStorage.getItem("customLogoFit");
        if (savedLogo) {
            setLogoPreviewUrl(savedLogo);
            setCurrentLogo(savedLogo);
        }
        if (savedFit === 'contain' || savedFit === 'cover') {
            setLogoFit(savedFit);
        }
    }, []);

    const handleSave = () => {
        try {
            if (logoPreviewUrl) {
                localStorage.setItem("customLogoUrl", logoPreviewUrl);
                setCurrentLogo(logoPreviewUrl);
            } else {
                localStorage.removeItem("customLogoUrl");
                setCurrentLogo(null);
            }
            localStorage.setItem("customLogoFit", logoFit);
            window.dispatchEvent(new Event('storage'));
            toast({
                title: "Settings Saved",
                description: "Your custom logo has been updated.",
            });
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
        setLogoPreviewUrl("");
        setCurrentLogo(null);
        setLogoFit('contain');
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
                setImageToCrop(result);
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
         // Reset the input value to allow re-uploading the same file
        event.target.value = '';
    };
    
    const handleCropComplete = (croppedImage: string) => {
        setLogoPreviewUrl(croppedImage);
        setImageToCrop(null);
         toast({
            title: "Image Cropped",
            description: "Image processed successfully. Click 'Save' to apply it.",
        });
    }

  return (
    <>
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
            Upload a custom logo. You will be able to crop and position the image before saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-4">
                     <h4 className="font-medium text-foreground">Configuration</h4>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileChange}
                        className="hidden" 
                        accept="image/png, image/jpeg, image/gif"
                    />
                    <div className="flex flex-col gap-2 pt-2 md:pt-0">
                        <Button onClick={handleUploadClick} className="w-full">
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Upload New Logo
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label>Logo Fit</Label>
                         <RadioGroup value={logoFit} onValueChange={(value) => setLogoFit(value as 'contain' | 'cover')} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="contain" id="r1" />
                                <Label htmlFor="r1">Contain (Show full logo)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="cover" id="r2" />
                                <Label htmlFor="r2">Cover (Fill space)</Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <Separator className="!my-6" />

                     <div className="flex flex-col gap-2">
                        <Button onClick={handleSave} disabled={!logoPreviewUrl} className="w-full">Save Changes</Button>
                        <Button variant="destructive" onClick={handleRevert} disabled={!currentLogo} className="w-full">
                            Revert to Default
                        </Button>
                    </div>
                </div>

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
                            {logoPreviewUrl ? (
                                <img 
                                    src={logoPreviewUrl} 
                                    alt="New logo preview" 
                                    className="max-w-full max-h-full"
                                    style={{ objectFit: logoFit }}
                                />
                            ) : (
                                <div className="text-muted-foreground flex flex-col items-center">
                                    <ImageIcon className="h-8 w-8" />
                                    <span className="text-xs mt-1">Upload an image</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
           </div>
        </CardContent>
      </Card>
    </div>
     <ImageCropperDialog 
        image={imageToCrop}
        onClose={() => setImageToCrop(null)}
        onCropComplete={handleCropComplete}
    />
    </>
  );
}
