
import * as React from "react";
import { cn } from "@/lib/utils";

// As the image is now static and within the public folder, 
// we can reference it directly.
const logoSrc = "/LOGO.png";

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <div className={cn("relative w-full h-full flex items-center justify-center", className)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={logoSrc}
                alt="Atlas Logo"
                className="w-full h-full object-contain rounded-md"
            />
        </div>
    );
};
