"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/auth/protected-route";
import { getRouteAccessForPath } from "@/lib/route-access";
import { Sidebar } from "./sidebar";
import { TopNavbar } from "./top-navbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarProvider, useSidebar } from "./sidebar-context";

interface AppShellProps {
  children: React.ReactNode;
}

function AppShellLayout({ children }: AppShellProps) {
  const { collapsed, mobileOpen, closeMobile, toggleCollapsed } = useSidebar();
  return (
    <div className="min-h-screen bg-hero-gradient dark:bg-none">
      <div className="mx-auto flex h-screen max-w-[1700px] overflow-hidden">
        <div className="hidden h-full shrink-0 md:block">
          <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
        </div>
        <Sheet open={mobileOpen} onOpenChange={(open: boolean) => (!open ? closeMobile() : undefined)}>
          <SheetContent side="left" className="w-72 border-slate-200 p-0 dark:border-slate-700 dark:bg-slate-950">
            <Sidebar collapsed={false} onToggle={toggleCollapsed} onNavigate={closeMobile} />
          </SheetContent>
        </Sheet>
        <motion.main layout className="flex-1 overflow-y-auto">
          <TopNavbar />
          <div className="p-3 md:p-6">{children}</div>
        </motion.main>
      </div>
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const accessRule = getRouteAccessForPath(pathname);

  return (
    <ProtectedRoute allowedRoles={accessRule?.allowedRoles} requiredPermissions={accessRule?.requiredPermissions}>
      <SidebarProvider>
        <AppShellLayout>{children}</AppShellLayout>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
