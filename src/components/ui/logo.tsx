
import * as React from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

export const Logo: React.FC<{ className?: string }> = ({ className }) => {
    return (
        <div className={cn("relative w-full h-full flex items-center justify-center", className)}>
            <Image
                src="/LOGO.PNG"
                alt="Atlas Logo"
                fill
                sizes="100%"
                style={{ 
                    objectFit: 'contain',
                }}
                className="rounded-md"
                unoptimized
            />
        </div>
    );
};
