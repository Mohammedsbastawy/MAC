"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

// This page now correctly serves as the entry point for /dashboard
// and redirects to the default devices page.
export default function DashboardRedirectPage() {
  const router = useRouter();
  const { isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      router.replace('/dashboard/devices');
    }
  }, [router, isLoading]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Redirecting to device dashboard...</p>
      </div>
    </main>
  );
}
