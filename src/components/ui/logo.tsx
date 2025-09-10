
import * as React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const DefaultLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" {...props}>
        <title>Atlas Systems Control Logo</title>
        <style>
            {`.st0{fill:hsl(var(--sidebar-foreground));}.st1{font-family:'Impact';}.st2{font-size:85px;}.st3{fill:none;stroke:hsl(var(--sidebar-foreground));stroke-width:8;stroke-miterlimit:10;}.st4{font-size:36px;}.st5{font-size:24px;}`}
        </style>
        <path className="st0" d="M256,134.4c-30.7,0-57.3,10-79,29.9c-21.7,20-33.1,45.4-33.1,73.6s11.4,53.7,33.1,73.6 c21.7,20,48.2,29.9,79,29.9s57.3-10,79-29.9c21.7-20,33.1-45.4,33.1-73.6s-11.4-53.7-33.1-73.6 C313.3,144.4,286.7,134.4,256,134.4z M256,290.4c-42.5,0-77-34.5-77-77s34.5-77,77-77s77,34.5,77,77S298.5,290.4,256,290.4z"/>
        <path className="st0" d="M256,126.9c-29.6,0-55.3,9.2-76.3,27.7c-21,18.5-32.3,42.1-32.3,68.3s11.3,49.8,32.3,68.3 c21,18.5,46.7,27.7,76.3,27.7s55.3-9.2,76.3-27.7c21-18.5,32.3-42.1,32.3-68.3s-11.3-49.8-32.3-68.3 C311.3,136.1,285.6,126.9,256,126.9z M256,295.6c-45.3,0-82.1-36.8-82.1-82.1s36.8-82.1,82.1-82.1s82.1,36.8,82.1,82.1 S301.3,295.6,256,295.6z"/>
        <text transform="matrix(1 0 0 1 189.98 214.28)" className="st0 st1 st2">ATLAS</text>
        <circle className="st3" cx="256" cy="221.5" r="141"/>
        <path className="st0" d="M211.5,404.4h88.9v-22.1h-88.9V404.4z M222.6,330.3h66.7v-22.1h-66.7V330.3z M256.3,425.2h-0.7 c-2.3,0-4.1-1.8-4.1-4.1v-12.8h10.2v12.8C260.4,423.3,258.6,425.2,256.3,425.2z"/>
        <g>
            <path className="st0" d="M256,368.5c-4.6,0-8.3-3.7-8.3-8.3v-26.6c0-4.6,3.7-8.3,8.3-8.3s8.3,3.7,8.3,8.3v26.6 C264.3,364.8,260.6,368.5,256,368.5z"/>
        </g>
        <text transform="matrix(1 0 0 1 123.77 265.86)" className="st0 st1 st4">NETWORK MANAGER</text>
        <text transform="matrix(1 0 0 1 161.42 173.34)" className="st0 st1 st5">SYSTEMS CONTROL</text>
        <text transform="matrix(1 0 0 1 202.93 454.4)" className="st0 st1 st5">BY BASTAWY</text>
    </svg>
);

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
    const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
    const [logoFit, setLogoFit] = React.useState<'contain' | 'cover'>('contain');
    const [isMounted, setIsMounted] = React.useState(false);

    const updateLogo = React.useCallback(() => {
        try {
            const storedUrl = localStorage.getItem("customLogoUrl");
            const storedFit = localStorage.getItem("customLogoFit");
            setLogoUrl(storedUrl);
            setLogoFit((storedFit === 'cover' || storedFit === 'contain') ? storedFit : 'contain');
        } catch (error) {
            console.warn("Could not access localStorage for custom logo.");
        }
    }, []);


    React.useEffect(() => {
        setIsMounted(true);
        updateLogo();
    }, [updateLogo]);

    // Effect to listen for storage changes
    React.useEffect(() => {
        window.addEventListener('storage', updateLogo);
        return () => {
            window.removeEventListener('storage', updateLogo);
        };
    }, [updateLogo]);

    if (!isMounted) {
        return <div className={cn("bg-muted rounded-full", className)} />;
    }

    if (logoUrl) {
        return (
            <div className={cn("relative w-full h-full flex items-center justify-center", className)}>
                <Image
                    src={logoUrl}
                    alt="Custom Atlas Logo"
                    fill
                    sizes="100%"
                    style={{ 
                        objectFit: logoFit,
                    }}
                    className="rounded-md"
                    unoptimized // Use this for external URLs and data URIs
                />
            </div>
        );
    }
    
    return <DefaultLogo className={className} />;
};
