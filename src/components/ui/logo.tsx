import * as React from "react";
import { cn } from "@/lib/utils";

export const Logo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-7 w-7", props.className)}
      {...props}
    >
      <title>Atlas Logo</title>
      <path d="M21 12.3333C21 17.134 16.9706 21.1667 12 21.1667C7.02944 21.1667 3 17.134 3 12.3333C3 7.53272 7.02944 3.5 12 3.5C16.9706 3.5 21 7.53272 21 12.3333Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 2.83331V21.8333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 12.3333L17.5 17.8333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 12.3333L6.5 17.8333" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};
