import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { AuthProvider } from "@/contexts/AuthContext"; 

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fund Pilot",
  description: "",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* AuthProvider is global; it won’t render sidebar or hero on its own */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
//         <AuthProvider>
//           <SidebarProvider>
//             <AppSidebar />
//             <SidebarInset>
//               <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
//                 <div className="flex items-center gap-2 px-4">
//                   <SidebarTrigger className="-ml-1" />
//                   <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
//                   <Breadcrumb>
//                     <BreadcrumbList>
//                       <BreadcrumbItem className="hidden md:block">
//                         <BreadcrumbLink href="#">Building Your Wealth Here</BreadcrumbLink>
//                       </BreadcrumbItem>
//                       <BreadcrumbSeparator className="hidden md:block" />
//                       <BreadcrumbItem>
//                         <BreadcrumbPage>Data Fetching</BreadcrumbPage>
//                       </BreadcrumbItem>
//                     </BreadcrumbList>
//                   </Breadcrumb>
//                 </div>
//               </header>
//               {children}
//             </SidebarInset>
//           </SidebarProvider>
//         </AuthProvider>
//       </body>
//     </html>
//   );
// }
