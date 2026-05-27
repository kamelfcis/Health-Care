"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/auth/protected-route";
import { useI18n } from "@/components/providers/i18n-provider";
import { getRouteAccessForPath } from "@/lib/route-access";
import { Sidebar } from "./sidebar";
import { TopNavbar } from "./top-navbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

function AppShellLayout({ children }: AppShellProps) {
  const { collapsed, mobileOpen, closeMobile, toggleCollapsed } = useSidebar();
  const { locale } = useI18n();
  const mobileSheetSide = locale === "ar" ? "right" : "left";

  return (
    <div className="min-h-screen bg-hero-gradient dark:bg-slate-950">
      <div className="mx-auto flex h-screen max-w-[1700px] overflow-hidden">
        <div className="hidden h-full shrink-0 md:block">
          <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} variant="desktop" />
        </div>

        <Sheet
          open={mobileOpen}
          onOpenChange={(open: boolean) => {
            if (!open) closeMobile();
          }}
        >
          <SheetContent
            side={mobileSheetSide}
            className={cn(
              "w-[min(19rem,90vw)] border-0 p-0 shadow-xl",
              "[&>button]:end-3 [&>button]:start-auto [&>button]:top-3 [&>button]:h-9 [&>button]:w-9 [&>button]:rounded-lg [&>button]:opacity-70 [&>button]:transition-opacity hover:[&>button]:opacity-100"
            )}
          >
            <div className="h-full overflow-hidden bg-white/98 backdrop-blur-xl dark:bg-slate-950/98">
              <Sidebar collapsed={false} onToggle={toggleCollapsed} onNavigate={closeMobile} variant="mobile" />
            </div>
          </SheetContent>
        </Sheet>

        <motion.main layout className="min-w-0 flex-1 overflow-y-auto">
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
