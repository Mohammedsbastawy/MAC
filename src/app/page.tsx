"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <p>Redirecting to dashboard...</p>
    </main>
  );
}
