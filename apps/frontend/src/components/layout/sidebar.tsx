"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, Calendar, ChevronDown, ChevronLeft, ClipboardList, CreditCard, LayoutDashboard, LogOut, Pill, Settings, Stethoscope, User, UserCog, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/components/providers/i18n-provider";
import { storage } from "@/lib/storage";
import { AuthUser } from "@/types";
import { hasAllPermissions } from "@/lib/permissions";
import { NAVIGATION_LINKS, NavigationLink } from "@/lib/route-access";
import { authService } from "@/lib/auth-service";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";

type SidebarLink = Omit<NavigationLink, "iconName"> & {
  icon: typeof LayoutDashboard;
};

const ICON_BY_NAME = {
  LayoutDashboard,
  Building2,
  ClipboardList,
  UserCog,
  Stethoscope,
  Users,
  Calendar,
  Pill,
  CreditCard,
  Wallet,
  Settings
} as const;

const links: SidebarLink[] = NAVIGATION_LINKS.map((link) => ({
  ...link,
  icon: ICON_BY_NAME[link.iconName]
}));

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onToggle, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUser(storage.getUser());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleLinks = useMemo(() => {
    return links.filter((link) => {
      if (link.allowedRoles?.length && (!user || !link.allowedRoles.includes(user.role))) {
        return false;
      }
      return hasAllPermissions(user, link.requiredPermissions ?? []);
    });
  }, [user]);

  useEffect(() => {
    setExpandedParents((prev) => {
      let changed = false;
      const next = { ...prev };
      visibleLinks.forEach((link) => {
        if (!link.children?.length) return;
        const hasActiveChild = link.children.some((child) => pathname.startsWith(child.href));
        if (hasActiveChild && !next[link.href]) {
          next[link.href] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [pathname, visibleLinks]);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      toast.error(t("common.logoutFailed"));
    } finally {
      queryClient.clear();
      storage.clearSession();
      onNavigate?.();
      router.replace("/login");
    }
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 92 : 288 }}
      transition={{ duration: 0.32, ease: "easeInOut" }}
      className="sticky top-0 h-screen overflow-y-auto border-r border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/85"
    >
      <div className="mb-8 flex items-center justify-between">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="rounded-2xl bg-orange-100 p-2 dark:bg-orange-900/40">
            <Image src="/healthcare.jpeg" alt="Healthcare CRM logo" width={38} height={38} className="rounded-xl" />
          </div>
          {!collapsed ? (
            <div>
              <p className="text-sm font-semibold text-brand-navy dark:text-slate-100">HealthCare CRM</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("nav.multiClinicSaas")}</p>
            </div>
          ) : null}
        </div>
        {!collapsed ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onToggle}>
            <ChevronLeft size={16} />
          </Button>
        ) : null}
      </div>

      <TooltipProvider delayDuration={120}>
        <nav className="space-y-1">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const active = pathname.startsWith(link.href);
          const hasActiveChild = Boolean(link.children?.some((child) => pathname.startsWith(child.href)));
          const isActive = active || hasActiveChild;
          const isExpandable = !collapsed && Boolean(link.children?.length);
          const isExpanded = expandedParents[link.href] ?? hasActiveChild;
          const itemBaseClass = cn(
            "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-base transition-all duration-300",
            isActive
              ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-md"
              : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-soft dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
          );
          const item = isExpandable ? (
            <button
              type="button"
              aria-label="Toggle section"
              onClick={() =>
                setExpandedParents((prev) => ({
                  ...prev,
                  [link.href]: !(prev[link.href] ?? hasActiveChild)
                }))
              }
              className={cn(itemBaseClass, "w-full text-right")}
            >
              <Icon size={16} className={cn(collapsed && "mx-auto")} />
              <span className="flex-1 text-right">{t(link.labelKey)}</span>
              <ChevronDown size={14} className={cn("transition-transform", isExpanded ? "rotate-180" : "")} />
            </button>
          ) : (
            <Link href={link.href} onClick={onNavigate} className={itemBaseClass}>
              <Icon size={16} className={cn(collapsed && "mx-auto")} />
              {!collapsed ? <span className="flex-1 text-right">{t(link.labelKey)}</span> : null}
            </Link>
          );

          if (!collapsed) {
            return (
              <div key={link.href} className="space-y-1">
                {item}
                {link.children?.length && isExpanded ? (
                  <div className="ms-4 space-y-1 border-s-2 border-slate-200 pe-1 ps-3 dark:border-slate-700">
                    {link.children.map((child) => {
                      const childActive = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={cn(
                            "block rounded-xl px-3 py-2 text-sm font-medium transition",
                            childActive
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200"
                              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          )}
                        >
                          {t(child.labelKey)}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }
          return (
            <Tooltip key={link.href}>
              <TooltipTrigger asChild>{item}</TooltipTrigger>
              <TooltipContent side="right">{t(link.labelKey)}</TooltipContent>
            </Tooltip>
          );
        })}
        </nav>
      </TooltipProvider>
      {!collapsed ? (
        <div ref={accountMenuRef} className="relative mt-4 border-t border-slate-200/70 pt-4 md:hidden dark:border-slate-700/60">
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/75 p-2 dark:border-slate-700 dark:bg-slate-900/70">
            <ThemeToggle />
            <LanguageToggle />
            <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <Bell size={16} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            </button>
          </div>
          <button
            type="button"
            className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/85 px-2 py-1.5 text-left text-slate-600 transition hover:shadow-soft dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-200"
            onClick={() => setAccountOpen((prev) => !prev)}
          >
            <div className="text-right">
              <p className="text-sm font-medium text-brand-navy dark:text-slate-100">
                {`${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || t("common.guest")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role ?? t("common.guest")}</p>
            </div>
            <ChevronDown size={15} className={cn("transition", accountOpen && "rotate-180")} />
          </button>
          {accountOpen ? (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-soft dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => {
                  setAccountOpen(false);
                  onNavigate?.();
                  router.push("/profile");
                }}
              >
                <User size={15} />
                {t("common.profile")}
              </button>
              <button
                type="button"
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut size={15} />
                {t("common.logout")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {collapsed ? (
        <Button variant="ghost" size="icon" className="absolute bottom-5 left-1/2 h-9 w-9 -translate-x-1/2 rounded-xl" onClick={onToggle}>
          <ChevronLeft size={16} className="rotate-180" />
        </Button>
      ) : null}
    </motion.aside>
  );
}
