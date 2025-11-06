"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { isLoading } = useAuth();

  useEffect(() => {
    // We wait until the auth state is determined before redirecting.
    if (!isLoading) {
      router.replace('/dashboard');
    }
  }, [router, isLoading]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading and redirecting to dashboard...</p>
      </div>
    </main>
  );
}
