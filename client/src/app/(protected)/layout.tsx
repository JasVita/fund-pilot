// /app/(protected)/layout.tsx
"use client";

import * as React from "react";
import "@/app/globals.css";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // --- SSR skeleton to keep server and client HTML identical
  if (!mounted) {
    return (
      <div
        suppressHydrationWarning
        className="flex min-h-svh w-full"
        style={
          {
            // keep the same CSS vars so layout doesn’t jump
            "--sidebar-width": "16rem",
            "--sidebar-width-icon": "3rem",
          } as React.CSSProperties
        }
      >
        {/* placeholder sidebar rail width on md+ */}
        <aside
          suppressHydrationWarning
          className="hidden md:block shrink-0"
          style={
            {
              "--sidebar-width": "16rem",
              "--sidebar-width-icon": "3rem",
            } as React.CSSProperties
          }
        />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  // --- real client layout after hydration
  return (
    <SidebarProvider>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": "16rem",
            "--sidebar-width-icon": "3rem",
          } as React.CSSProperties
        }
        className="group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full"
      >
        <AppSidebar />
        <SidebarInset className="flex-1">{children}</SidebarInset>
      </div>
    </SidebarProvider>
  );
}
