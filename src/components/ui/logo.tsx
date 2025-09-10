import * as React from "react";
import { cn } from "@/lib/utils";

export const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 400 100"
        className={cn("h-16 w-auto", props.className)}
        {...props}
    >
        <title>Atlas Systems Control Logo</title>
        <defs>
            <linearGradient id="globe-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: "hsl(var(--primary))", stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: "hsl(var(--accent-foreground))", stopOpacity: 0.8}} />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>

        {/* Globe */}
        <circle cx="50" cy="50" r="40" fill="url(#globe-gradient)" />
        <g stroke="hsl(var(--background))" strokeWidth="0.5" strokeOpacity="0.5">
            {/* Latitudes */}
            <ellipse cx="50" cy="50" rx="40" ry="15" fill="none" />
            <ellipse cx="50" cy="50" rx="35" ry="28" fill="none" />
            <ellipse cx="50" cy="50" rx="25" ry="36" fill="none" />
             {/* Longitudes */}
            <path d="M50 10 V 90" fill="none" />
            <ellipse cx="50" cy="50" rx="20" ry="40" fill="none" transform="rotate(30 50 50)" />
            <ellipse cx="50" cy="50" rx="20" ry="40" fill="none" transform="rotate(-30 50 50)" />
            <ellipse cx="50" cy="50" rx="20" ry="40" fill="none" transform="rotate(60 50 50)" />
            <ellipse cx="50" cy="50" rx="20" ry="40" fill="none" transform="rotate(-60 50 50)" />
        </g>
        
        {/* Atlas Figure */}
        <g fill="hsl(var(--sidebar-foreground))" transform="translate(0, 5)">
            {/* Body */}
            <path d="M50 62 l-4 -8 h8 z M46 54 l-2 -4 h12 l-2 4 z M44 50 l-2 -4 h16 l-2 4 z" />
            {/* Arms */}
            <path d="M42 50 q-8 -4 -12 -12 l4 1 q8 8 8 11 z M58 50 q8 -4 12 -12 l-4 1 q-8 8 -8 11 z" />
            {/* Head */}
            <circle cx="50" cy="44" r="3" />
            {/* Globe on shoulders */}
            <circle cx="50" cy="35" r="10" fill="none" stroke="hsl(var(--sidebar-foreground))" strokeWidth="1.5" />
        </g>
      
        {/* Text block */}
        <g transform="translate(115, 8)">
            <text
                x="0"
                y="35"
                fontFamily="Inter, sans-serif"
                fontSize="32"
                fontWeight="bold"
                fill="hsl(var(--foreground))"
                letterSpacing="-1"
            >
                ATLAS
            </text>
            <text
                x="0"
                y="52"
                fontFamily="Inter, sans-serif"
                fontSize="12"
                fontWeight="500"
                fill="hsl(var(--primary))"
                letterSpacing="0"
            >
                NETWORK MANAGER
            </text>
            <text
                x="0"
                y="68"
                fontFamily="Inter, sans-serif"
                fontSize="12"
                fontWeight="500"
                fill="hsl(var(--foreground))"
                letterSpacing="0"
            >
                SYSTEMS CONTROL
            </text>
            <text
                x="0"
                y="85"
                fontFamily="Inter, sans-serif"
                fontSize="10"
                fontWeight="normal"
                fill="hsl(var(--muted-foreground))"
                letterSpacing="0.1em"
            >
                BY BASTAWY
            </text>
        </g>
    </svg>
  );
};
