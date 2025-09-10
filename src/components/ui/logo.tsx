import * as React from "react";
import { cn } from "@/lib/utils";

export const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 40"
      className={cn("h-10 w-auto", props.className)}
      {...props}
    >
      <title>Atlas by Bastawy Logo</title>
      {/* Globe Icon */}
      <g fill="hsl(var(--primary))">
        {/* Outer Circle */}
        <path
          d="M20,2.5 C30.77,2.5 39.5,11.23 39.5,22 C39.5,32.77 30.77,41.5 20,41.5 C9.23,41.5 0.5,32.77 0.5,22 C0.5,11.23 9.23,2.5 20,2.5 Z M20,0 C8.954,0 0,8.954 0,20s8.954,20 20,20 20-8.954 20-20S31.046,0 20,0 Z"
          transform="translate(0, -2)"
        />
        {/* Inner Grid */}
        <g fill="hsl(var(--accent-foreground))" opacity="0.8">
          {/* Ellipse */}
          <path
            d="M20,5 C29.39,5 37,12.61 37,22 C37,31.39 29.39,39 20,39 C10.61,39 3,31.39 3,22 C3,12.61 10.61,5 20,5 Z M20,2 C8.95,2 2,11.05 2,22 C2,32.95 8.95,42 20,42 C31.05,42 38,32.95 38,22 C38,11.05 31.05,2 20,2 Z"
            transform="translate(0, -2)"
          />
          {/* Horizontal Lines */}
          <path
            d="M5,15 H35 M5,29 H35"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            fill="none"
             transform="translate(0, -2)"
          />
          {/* Vertical Lines */}
          <path
            d="M13,5 V39 M27,5 V39"
             stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            fill="none"
             transform="translate(0, -2)"
          />
        </g>
      </g>
      {/* Text */}
      <g transform="translate(50, 0)">
        <text
          x="0"
          y="23"
          fontFamily="Inter, sans-serif"
          fontSize="24"
          fontWeight="bold"
          fill="hsl(var(--foreground))"
        >
          ATLAS
        </text>
        <text
          x="0"
          y="37"
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
