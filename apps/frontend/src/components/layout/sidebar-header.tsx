"use client";

import Image from "next/image";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/i18n-provider";
import { BRAND } from "@/lib/brand";

interface SidebarHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
}

export function SidebarHeader({ collapsed, onToggle, mobile }: SidebarHeaderProps) {
  const { t, locale } = useI18n();
  const ToggleIcon = collapsed ? PanelRightOpen : PanelRightClose;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2.5 border-b border-slate-200/50 pb-4 dark:border-slate-800/50",
        collapsed ? "flex-col justify-center px-1" : "w-full justify-between px-1"
      )}
    >
      <div className={cn("flex min-w-0 items-center gap-2.5", collapsed && "flex-col")}>
        <div
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900",
            collapsed ? "h-10 w-10" : "h-11 w-11"
          )}
        >
          <Image
            src={BRAND.logoSrc}
            alt={collapsed ? BRAND.logoAlt : ""}
            width={collapsed ? 36 : 40}
            height={collapsed ? 36 : 40}
            className="h-full w-full object-contain p-0.5"
          />
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1 text-start">
            <p
              className={cn(
                "truncate font-semibold tracking-tight text-slate-900 dark:text-slate-50",
                locale === "ar" ? "text-[15px]" : "text-sm"
              )}
            >
              {BRAND.name}
            </p>
            <p className={cn("truncate text-slate-500 dark:text-slate-400", locale === "ar" ? "text-xs" : "text-[11px]")}>
              {t("nav.multiClinicSaas")}
            </p>
          </div>
        ) : null}
      </div>
      {!mobile ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className={cn(
            "h-9 w-9 shrink-0 rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/60",
            collapsed && "mt-1"
          )}
          aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
        >
          <ToggleIcon size={18} strokeWidth={1.75} />
        </Button>
      ) : null}
    </div>
  );
}
