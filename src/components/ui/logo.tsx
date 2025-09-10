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
        <clipPath id="circle-clip">
          <circle cx="50" cy="50" r="48" />
        </clipPath>
      </defs>

      {/* Main Circle */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="hsl(var(--foreground))" strokeWidth="3" />

      {/* Atlas Figure */}
      <g fill="hsl(var(--foreground))">
        {/* Body */}
        <path d="M50 72 l-5 -10 h10 z M45 62 l-2 -5 h14 l-2 5 z M43 57 l-2 -5 h18 l-2 5 z M41 52 l-1 -5 h20 l-1 5 z" />
        {/* Arms */}
        <path d="M40 52 q-10 -5 -15 -15 l5 2 q10 10 10 13 z M60 52 q10 -5 15 -15 l-5 2 q-10 10 -10 13 z" />
        {/* Head */}
        <circle cx="50" cy="45" r="4" />
      </g>
      
      {/* Globe and Network Elements */}
      <g clipPath="url(#circle-clip)" fill="hsl(var(--primary))">
        {/* Globe wireframe */}
        <ellipse cx="50" cy="35" rx="25" ry="12" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5"/>
        <path d="M50 23 v24 M28 30 a23,10 0 0 1 44 0 M28 40 a23,10 0 0 0 44 0" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5"/>
        <path d="M40 24 a15,12 0 0 1 0 22 M60 24 a15,12 0 0 0 0 22" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5"/>

        {/* Central Wifi Icon */}
        <g transform="translate(43, 28)">
            <path d="M7,6 A5,5 0 0 1 1,0 M7,6 A9,9 0 0 1 -3,-2" stroke="hsl(var(--foreground))" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <circle cx="4" cy="4" r="1.5" fill="hsl(var(--foreground))"/>
        </g>

        {/* Smaller wifi icons */}
        <g transform="translate(68, 25) scale(0.6)">
             <path d="M7,6 A5,5 0 0 1 1,0 M7,6 A9,9 0 0 1 -3,-2" stroke="hsl(var(--foreground))" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
         <g transform="translate(25, 25) scale(0.6) scale(-1,1)">
             <path d="M7,6 A5,5 0 0 1 1,0 M7,6 A9,9 0 0 1 -3,-2" stroke="hsl(var(--foreground))" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
        <g transform="translate(80, 38) scale(0.5)">
             <path d="M7,6 A5,5 0 0 1 1,0 M7,6 A9,9 0 0 1 -3,-2" stroke="hsl(var(--foreground))" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        </g>
        <g transform="translate(13, 38) scale(0.5) scale(-1,1)">
             <path d="M7,6 A5,5 0 0 1 1,0 M7,6 A9,9 0 0 1 -3,-2" stroke="hsl(var(--foreground))" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        </g>

         {/* Connection Dots */}
        <path d="M35 48 h-5 l-3 -3 M65 48 h5 l3 -3" stroke="hsl(var(--primary))" strokeWidth="1.5" fill="none"/>
        <circle cx="35" cy="48" r="1.5" />
        <circle cx="30" cy="48" r="1.5" />
        <circle cx="65" cy="48" r="1.5" />
        <circle cx="70" cy="48" r="1.5" />
      </g>

      {/* Text block */}
      <g transform="translate(120, 0)">
        <text
          x="0"
          y="40"
          fontFamily="Inter, sans-serif"
          fontSize="36"
          fontWeight="bold"
          fill="hsl(var(--foreground))"
        >
          ATLAS
        </text>
         <text
          x="0"
          y="60"
          fontFamily="Inter, sans-serif"
          fontSize="14"
          fontWeight="500"
          fill="hsl(var(--primary))"
          letterSpacing="0.05em"
        >
          NETWORK MANAGER
        </text>
         <text
          x="0"
          y="78"
          fontFamily="Inter, sans-serif"
          fontSize="14"
          fontWeight="500"
          fill="hsl(var(--foreground))"
          letterSpacing="0.05em"
        >
          SYSTEMS CONTROL
        </text>
        <text
          x="0"
          y="95"
          fontFamily="Inter, sans-serif"
          fontSize="10"
          fontWeight="medium"
          fill="hsl(var(--muted-foreground))"
          letterSpacing="0.1em"
        >
          BY BASTAWY
        </text>
      </g>
    </svg>
  );
};
