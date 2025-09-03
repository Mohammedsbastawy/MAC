import type { Metadata } from "next";
import DashboardHeader from "@/components/dashboard/header";

export const metadata: Metadata = {
  title: "Dashboard - Dominion Control Panel",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col">
      <DashboardHeader />
      <main className="flex-1 p-4 sm:p-6 md:p-8">{children}</main>
    </div>
  );
}
