"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This page now simply redirects to the new default devices page.
export default function DashboardRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/devices');
  }, [router]);

  return (
     <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-center h-[calc(100vh-200px)]">
        <p>Redirecting to device list...</p>
    </div>
  )
}
