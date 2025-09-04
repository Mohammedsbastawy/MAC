"use client";

import DashboardHeader from "@/components/dashboard/header";
import { AuthProvider } from "@/hooks/use-auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen w-full flex-col">
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </AuthProvider>
  );
}
