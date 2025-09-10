import * as React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const DefaultLogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
     <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 200 200"
        {...props}
    >
        <title>Atlas Systems Control Logo</title>
        <defs>
            <linearGradient id="globe-gradient" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--accent-foreground))" />
            </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="90" fill="url(#globe-gradient)" />
        <g stroke="hsl(var(--sidebar-background))" strokeWidth="2" strokeOpacity="0.6">
            <ellipse cx="100" cy="100" rx="90" ry="30" fill="none" />
            <ellipse cx="100" cy="100" rx="80" ry="60" fill="none" />
            <ellipse cx="100" cy="100" rx="60" ry="80" fill="none" />
            <path d="M100 10 V 190" fill="none" />
            <ellipse cx="100" cy="100" rx="45" ry="90" fill="none" transform="rotate(30 100 100)" />
            <ellipse cx="100" cy="100" rx="45" ry="90" fill="none" transform="rotate(-30 100 100)" />
            <ellipse cx="100" cy="100" rx="45" ry="90" fill="none" transform="rotate(60 100 100)" />
            <ellipse cx="100" cy="100" rx="45" ry="90" fill="none" transform="rotate(-60 100 100)" />
        </g>
        <g fill="hsl(var(--sidebar-foreground))" transform="translate(15 15) scale(0.85)">
            <path d="M100 120 l-8 -15 h16 z M92 105 l-4 -8 h24 l-4 8 z M88 97 l-4 -8 h32 l-4 8 z" />
            <path d="M84 97 q-16 -8 -24 -24 l8 2 q16 16 16 22 z M116 97 q16 -8 24 -24 l-8 2 q-16 16 -16 22 z" />
            <circle cx="100" cy="87" r="6" />
            <circle cx="100" cy="65" r="20" fill="none" stroke="hsl(var(--sidebar-foreground))" strokeWidth="3" />
        </g>
    </svg>
);


export const Logo: React.FC<{ className?: string }> = ({ className }) => {
    const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
        try {
            const storedUrl = localStorage.getItem("customLogoUrl");
            if (storedUrl) {
                setLogoUrl(storedUrl);
            }
        } catch (error) {
            console.warn("Could not access localStorage for custom logo.");
        }
    }, []);

    // Effect to listen for storage changes
    React.useEffect(() => {
        const handleStorageChange = () => {
            try {
                const storedUrl = localStorage.getItem("customLogoUrl");
                setLogoUrl(storedUrl);
            } catch (error) {
                 console.warn("Could not access localStorage for custom logo.");
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    if (!isMounted) {
        return <div className={cn("bg-muted rounded-full", className)} />;
    }

    if (logoUrl) {
        return (
            <div className={cn("relative", className)}>
                <Image
                    src={logoUrl}
                    alt="Custom Atlas Logo"
                    layout="fill"
                    objectFit="contain"
                    className="rounded-md"
                    unoptimized // Use this if the image source is external and not configured in next.config.js
                />
            </div>
        );
    }
    
    return <DefaultLogo className={className} />;
};
