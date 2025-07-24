"use client";

import * as React from "react";
// import {
//   ChartColumn,
//   Users,
//   FileText,
//   MessageSquare,
//   GalleryVerticalEnd,
//   Frame,
//   PieChart,
//   Map,
//   LucideProps
// } from "lucide-react";
import { LucideProps, ChartColumn, Users, FileText, MessageSquare,
         Frame, PieChart, Map } from "lucide-react";
import Image from "next/image";
import Link from "next/link"; 
import { cn } from "@/lib/utils";
import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/contexts/AuthContext";
// import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";

/* ------------ mini <FundPilotLogo/> used like a Lucide icon ----- */
const FundPilotLogo = ({ className }: LucideProps) => (
  <span className={cn("relative inline-block h-full w-full", className)}>
    <Image
      src="/fund-pilot-logo-black.png"
      alt="Fund Pilot"
      fill
      sizes="128px"
      className="object-contain"
      priority
    />
  </span>
);


const navMain = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: ChartColumn,
    isActive: true,
    items: [
      // {
      //   title: "History",
      //   url: "#",
      // },
      // {
      //   title: "Starred",
      //   url: "#",
      // },
      // {
      //   title: "Settings",
      //   url: "#",
      // },
    ],
  },
  {
    title: "Investors",
    url: "/investors",
    icon: Users,
    items: [
      // {
      //   title: "Genesis",
      //   url: "#",
      // },
      // {
      //   title: "Explorer",
      //   url: "#",
      // },
      // {
      //   title: "Quantum",
      //   url: "#",
      // },
    ],
  },
  {
    title: "Files",
    url: "/files",
    icon: FileText,
    items: [
      {
        title: "Files Dashboard",
        url: "/files/dashboard",
      },
      // {
      //   title: "Folders",
      //   url: "/files/folders",
      // },
      // {
      //   title: "Upload Files",
      //   url: "/files/uploads",
      // },
      // {
      //   title: "Uploads",
      //   url: "#",
      // },
    ],
  },
  {
    title: "AI Chat",
    url: "/ai-chat",
    icon: MessageSquare,
    items: [
      // {
      //   title: "General",
      //   url: "#",
      // },
      // {
      //   title: "Team",
      //   url: "#",
      // },
      // {
      //   title: "Billing",
      //   url: "#",
      // },
      // {
      //   title: "Limits",
      //   url: "#",
      // },
    ],
  },
];



const teams = [
  { name: "Fund Pilot", logo: FundPilotLogo, plan: "Enterprise" },
];

const projects = [
  { name: "Design Engineering", url: "#", icon: Frame },
  { name: "Sales & Marketing", url: "#", icon: PieChart },
  { name: "Travel", url: "#", icon: Map },
];



/* ---------- component ---------- */

export function AppSidebar( props: React.ComponentProps<typeof Sidebar>, ) {
  const { user } = useAuth();

  /* render nothing during SSR ‑‑> no mismatch */
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  if (!ready) {
    return (
      <aside
        suppressHydrationWarning
        style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "3rem" } as React.CSSProperties}
        className="hidden md:block shrink-0"
      />
    );
  }

  /* ----------------------------------------------------------
   * 1️⃣  ensure client‑only rendering
   * ---------------------------------------------------------- */
  // const [mounted, setMounted] = React.useState(false);
  // React.useEffect(() => setMounted(true), []);

  // /* Skeleton shown during SSR and the first client pass.
  //  * Must be *identical* on server & client to keep hydration happy. */
  // if (!mounted) {
  //   return (
  //     <aside
  //       /* keep the same CSS variables so layout doesn’t jump */
  //       style={
  //         {
  //           "--sidebar-width": "16rem",
  //           "--sidebar-width-icon": "3rem",
  //         } as React.CSSProperties
  //       }
  //       /* minimal classes so the rest of the layout still flows */
  //       className="hidden md:block shrink-0"
  //     />
  //   );
  // }

  /* ---------- header (logo + text) ------------------------------ */
  const HeaderContent = () => {
    /* ✱ derive collapsed flag – covers both APIs */
    const sb         = useSidebar() as any
    const collapsed: boolean =
      typeof sb.collapsed === "boolean"
        ? sb.collapsed
        : sb.state === "collapsed" || sb.state === "rail"

    return (
      <>
        {/* logo + label row */}
        <div
          className={cn(
            "w-full px-3 flex transition-all",
            collapsed
              ? "flex-col items-center gap-2"
              : "flex-row items-center gap-3",
          )}
        >
          {/* logo (auto-scales) */}
          <div
            className={cn(
              "flex aspect-square items-center justify-center transition-all",
              collapsed ? "h-12 w-12" : "h-16 w-25",
            )}
          >
            <FundPilotLogo
              className={cn(
                "transition-all",
                collapsed ? "h-8 w-8" : "h-16 w-18",
              )}
            />
          </div>

          {/* text – hidden in rail mode */}
          {!collapsed && (
            <div className="leading-tight">
              <h1 className="font-bold text-base">Fund&nbsp;Pilot</h1>
              <p className="text-xs text-muted-foreground">Enterprise</p>
            </div>
          )}
        </div>

        {/* responsive divider */}
        <hr
          className={cn(
            "border-t border-border transition-all",
            collapsed ? "mx-auto w-8" : "mx-4 w-[calc(100%-2rem)]",
          )}
        />
      </>
    )
  }


  /* ── debug ─────────────────────────────────────────── */
  // React.useEffect(() => {
  //   console.log("[AppSidebar] Nav-user payload →", {
  //     name: user?.name,
  //     email: user?.email,
  //     avatar: user?.avatar || "/logo-white-table.png",
  //   });
  // }, [user]);
  /* ─────────────────────────────────────────────────── */

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <HeaderContent />
        {/* <TeamSwitcher teams={teams} /> */}
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
        {/* <NavProjects projects={projects} /> */}
      </SidebarContent>

      {/* <SidebarContent>
        <NavMain items={navMain} />
        <NavProjects projects={projects} />
      </SidebarContent> */}

      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              name: user.name,
              email: user.email,
              avatar: user.avatar || "/logo-white-table.png",
            }}
          />
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}