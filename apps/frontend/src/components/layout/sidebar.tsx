"use client";

import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PanelRightOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useI18n } from "@/components/providers/i18n-provider";
import { storage } from "@/lib/storage";
import { AuthUser } from "@/types";
import { hasAllPermissions } from "@/lib/permissions";
import {
  getRouteAccessForPath,
  NAVIGATION_LINKS,
  NavigationChildLink,
  NavigationLink
} from "@/lib/route-access";
import { authService } from "@/lib/auth-service";
import { SIDEBAR_ICON_BY_NAME } from "./sidebar-icons";
import {
  getSidebarSectionForHref,
  SIDEBAR_SECTION_LABEL_KEYS,
  SIDEBAR_SECTION_ORDER,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  type SidebarSectionId
} from "./sidebar-sections";
import {
  SidebarNavChild,
  SidebarNavItem,
  SidebarNavParent,
  SidebarSectionLabel
} from "./sidebar-nav-item";
import { SidebarHeader } from "./sidebar-header";
import { SidebarAccount } from "./sidebar-account";

type SidebarLink = Omit<NavigationLink, "iconName"> & {
  icon: (typeof SIDEBAR_ICON_BY_NAME)[NavigationLink["iconName"]];
};

const links: SidebarLink[] = NAVIGATION_LINKS.map((link) => ({
  ...link,
  icon: SIDEBAR_ICON_BY_NAME[link.iconName]
}));

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  /** Mobile drawer: full nav without desktop collapse chrome */
  variant?: "desktop" | "mobile";
}

function isPathActive(pathname: string, href: string) {
  const normalized = href.endsWith("/") && href !== "/" ? href.slice(0, -1) : href;
  if (normalized === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === normalized || pathname.startsWith(`${normalized}/`);
}

export function Sidebar({ collapsed, onToggle, onNavigate, variant = "desktop" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const isMobileDrawer = variant === "mobile";
  const showCollapsed = collapsed && !isMobileDrawer;

  useEffect(() => {
    setUser(storage.getUser());
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
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

  const getVisibleChildren = useCallback(
    (link: SidebarLink): NavigationChildLink[] => {
      if (!link.children?.length) return [];
      return link.children.filter((child) => {
        const rule = getRouteAccessForPath(child.href);
        if (rule?.allowedRoles?.length && (!user || !rule.allowedRoles.includes(user.role))) {
          return false;
        }
        return hasAllPermissions(user, rule?.requiredPermissions ?? []);
      });
    },
    [user]
  );

  useEffect(() => {
    setExpandedParents((prev) => {
      let changed = false;
      const next = { ...prev };
      visibleLinks.forEach((link) => {
        const children = getVisibleChildren(link);
        if (!children.length) return;
        const hasActiveChild = children.some((child) => isPathActive(pathname, child.href));
        if (hasActiveChild && !next[link.href]) {
          next[link.href] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [pathname, visibleLinks, getVisibleChildren]);

  const linksBySection = useMemo(() => {
    const grouped = new Map<SidebarSectionId, SidebarLink[]>();
    for (const sectionId of SIDEBAR_SECTION_ORDER) {
      grouped.set(sectionId, []);
    }
    for (const link of visibleLinks) {
      const section = getSidebarSectionForHref(link.href);
      grouped.get(section)?.push(link);
    }
    return grouped;
  }, [visibleLinks]);

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

  const renderLink = (link: SidebarLink) => {
    const visibleChildren = getVisibleChildren(link);
    const active = isPathActive(pathname, link.href);
    const hasActiveChild = visibleChildren.some((child) => isPathActive(pathname, child.href));
    const isActive = active || hasActiveChild;
    const isExpanded = expandedParents[link.href] ?? hasActiveChild;
    const label = t(link.labelKey);
    const hasChildren = visibleChildren.length > 0;

    if (hasChildren && !showCollapsed) {
      return (
        <SidebarNavParent
          key={link.href}
          href={link.href}
          label={label}
          icon={link.icon}
          active={isActive}
          expanded={isExpanded}
          collapsed={false}
          comingSoon={link.comingSoon}
          onNavigate={onNavigate}
          onToggleExpand={() =>
            setExpandedParents((prev) => ({
              ...prev,
              [link.href]: !(prev[link.href] ?? hasActiveChild)
            }))
          }
        >
          {isExpanded ? (
            <ul role="list" className="m-0 flex w-full list-none flex-col gap-1">
              {visibleChildren.map((child) => (
                <SidebarNavChild
                  key={child.href}
                  href={child.href}
                  label={t(child.labelKey)}
                  active={isPathActive(pathname, child.href)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          ) : null}
        </SidebarNavParent>
      );
    }

    return (
      <SidebarNavItem
        key={link.href}
        href={link.href}
        label={label}
        icon={link.icon}
        active={isActive}
        collapsed={showCollapsed}
        comingSoon={link.comingSoon}
        onNavigate={onNavigate}
      />
    );
  };

  return (
    <motion.aside
      animate={{ width: showCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative flex h-screen min-h-0 flex-col md:h-full md:max-h-screen md:sticky md:top-0",
        "border-e border-slate-200/70 bg-white/98 shadow-[1px_0_0_0_rgba(15,23,42,0.04)] backdrop-blur-md",
        "dark:border-slate-800/80 dark:bg-slate-950/98 dark:shadow-none",
        showCollapsed ? "px-2 py-4" : "px-3 py-4",
        isMobileDrawer && "w-full max-w-none border-0 shadow-none"
      )}
    >
      <SidebarHeader collapsed={showCollapsed} onToggle={onToggle} mobile={isMobileDrawer} />

      <TooltipProvider delayDuration={100}>
        <nav
          aria-label={t("nav.mainNavigation")}
          className="mt-5 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden px-0 [-ms-overflow-style:none] [scrollbar-width:thin]"
        >
          {SIDEBAR_SECTION_ORDER.map((sectionId) => {
            const sectionLinks = linksBySection.get(sectionId) ?? [];
            if (!sectionLinks.length) return null;
            const sectionLabel = t(SIDEBAR_SECTION_LABEL_KEYS[sectionId]);
            return (
              <div key={sectionId} className="flex w-full flex-col gap-1">
                <SidebarSectionLabel label={sectionLabel} collapsed={showCollapsed} />
                {sectionLinks.map(renderLink)}
              </div>
            );
          })}
        </nav>
      </TooltipProvider>

      {!showCollapsed ? (
        <SidebarAccount
          user={user}
          open={accountOpen}
          onToggle={() => setAccountOpen((prev) => !prev)}
          onLogout={handleLogout}
          onNavigate={onNavigate}
          menuRef={accountMenuRef}
        />
      ) : null}

      {showCollapsed ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-2 h-10 w-full shrink-0 rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/50"
          onClick={onToggle}
          aria-label={t("nav.expandSidebar")}
        >
          <PanelRightOpen size={17} strokeWidth={1.75} />
        </Button>
      ) : null}
    </motion.aside>
  );
}
