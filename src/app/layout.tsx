import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { ThemeProviderClient } from "@/components/theme-provider-client";

// Polyfill localStorage for Server-Side Rendering
if (typeof localStorage === "undefined" || localStorage === null) {
  const { LocalStorage } = require("node-localstorage");
  global.localStorage = new LocalStorage("./scratch");
}

export const metadata: Metadata = {
  title: 'Dominion Control Panel',
  description: 'Manage your network devices with ease.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Permanent+Marker&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ThemeProviderClient>
          {children}
          <Toaster />
        </ThemeProviderClient>
      </body>
    </html>
  );
}
