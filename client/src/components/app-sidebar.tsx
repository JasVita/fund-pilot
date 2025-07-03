"use client";

import * as React from "react";
import {
  ChartColumn,
  Users,
  FileText,
  MessageSquare,
  GalleryVerticalEnd,
  Frame,
  PieChart,
  Map,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavProjects } from "@/components/nav-projects";
import { NavUser } from "@/components/nav-user";
import { useAuth } from "@/contexts/AuthContext";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

/* ---------- static data ---------- */

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
  // {
  //   title: "Files",
  //   url: "/files",
  //   icon: FileText,
  //   items: [
  //     // {
  //     //   title: "Introduction",
  //     //   url: "#",
  //     // },
  //     // {
  //     //   title: "Get Started",
  //     //   url: "#",
  //     // },
  //     // {
  //     //   title: "Tutorials",
  //     //   url: "#",
  //     // },
  //     // {
  //     //   title: "Changelog",
  //     //   url: "#",
  //     // },
  //   ],
  // },
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
  { name: "Fund Pilot", logo: GalleryVerticalEnd, plan: "Enterprise" },
];

const projects = [
  { name: "Design Engineering", url: "#", icon: Frame },
  { name: "Sales & Marketing", url: "#", icon: PieChart },
  { name: "Travel", url: "#", icon: Map },
];

/* ---------- component ---------- */

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth();
  // console.log("%c[Sidebar] user from context:", "color:violet", user);
  /* ── debug ─────────────────────────────────────────── */
  React.useEffect(() => {
    console.log("[AppSidebar] Nav-user payload →", {
      name:   user?.name,
      email:  user?.email,
      avatar: user?.avatar || "/logo-white-table.png",
    });
  }, [user]);
  /* ─────────────────────────────────────────────────── */
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMain} />
        {/* <NavProjects projects={projects} /> */}
      </SidebarContent>

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
