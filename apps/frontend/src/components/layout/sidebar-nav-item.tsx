"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/components/providers/i18n-provider";
import type { Locale } from "@/lib/i18n";
import { SIDEBAR_ICON_SIZE, SIDEBAR_ICON_STROKE, type SidebarIconComponent } from "./sidebar-icons";

const transitionBase = "transition-[color,background-color,box-shadow] duration-200 ease-out";

export const sidebarActiveIndicatorClass =
  "before:pointer-events-none before:absolute before:inset-y-2.5 before:start-0 before:w-[3px] before:rounded-full before:bg-orange-500 before:content-[''] dark:before:bg-orange-400";

export function sidebarNavTextClass(locale: Locale, nested?: boolean) {
  return cn(
    nested
      ? locale === "ar"
        ? "text-[15px] leading-snug"
        : "text-[14px] leading-snug"
      : locale === "ar"
        ? "text-[17px] leading-snug"
        : "text-base leading-snug"
  );
}

export const sidebarNavItemClass = (active: boolean, locale: Locale, options?: { nested?: boolean }) =>
  cn(
    "group relative flex w-full min-h-11 items-center justify-start gap-3 rounded-lg px-3 py-2.5 text-start",
    options?.nested && "min-h-10",
    sidebarNavTextClass(locale, options?.nested),
    transitionBase,
    active
      ? "bg-orange-50 font-medium text-orange-700 dark:bg-primary/14 dark:text-[hsl(28,72%,68%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      : "font-normal text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-accent dark:hover:text-foreground"
  );

function SidebarNavIcon({ icon: Icon, active }: { icon: SidebarIconComponent; active: boolean }) {
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center" aria-hidden>
      <Icon
        size={SIDEBAR_ICON_SIZE}
        strokeWidth={SIDEBAR_ICON_STROKE}
        className={cn(
          active
            ? "text-orange-600 dark:text-orange-400"
            : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
        )}
      />
    </span>
  );
}

export function ComingSoonBadge({ subdued }: { subdued?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-normal",
        locale === "ar" ? "tracking-normal" : "uppercase tracking-wider",
        subdued
          ? "border-orange-200/70 bg-orange-50/80 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300"
          : "border-amber-200/70 bg-amber-50/80 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
      )}
    >
      {t("nav.comingSoon")}
    </span>
  );
}

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: SidebarIconComponent;
  active: boolean;
  collapsed: boolean;
  comingSoon?: boolean;
  onNavigate?: () => void;
  tooltipSide?: "left" | "right";
}

export function SidebarNavItem({
  href,
  label,
  icon,
  active,
  collapsed,
  comingSoon,
  onNavigate,
  tooltipSide
}: SidebarNavItemProps) {
  const { t, locale } = useI18n();
  const resolvedTooltipSide = tooltipSide ?? (locale === "ar" ? "left" : "right");

  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        sidebarNavItemClass(active, locale),
        active && sidebarActiveIndicatorClass,
        collapsed && "mx-auto h-10 w-10 min-h-10 justify-center px-0 py-0"
      )}
    >
      <SidebarNavIcon icon={icon} active={active} />
      {!collapsed ? (
        <>
          <span className="min-w-0 max-w-[calc(100%-2rem)] truncate">{label}</span>
          {comingSoon ? <ComingSoonBadge subdued={active} /> : null}
        </>
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent
        side={resolvedTooltipSide}
        className="border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-slate-800 shadow-md dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100"
      >
        <p className={cn("text-start font-normal", locale === "ar" ? "text-sm" : "text-xs")}>{label}</p>
        {comingSoon ? (
          <p className="mt-0.5 text-start text-[10px] text-orange-600 dark:text-orange-400">{t("nav.comingSoon")}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

interface SidebarNavParentProps {
  href: string;
  label: string;
  icon: SidebarIconComponent;
  active: boolean;
  expanded: boolean;
  collapsed: boolean;
  comingSoon?: boolean;
  onNavigate?: () => void;
  onToggleExpand: () => void;
  children: React.ReactNode;
}

export function SidebarNavParent({
  href,
  label,
  icon,
  active,
  expanded,
  collapsed,
  comingSoon,
  onNavigate,
  onToggleExpand,
  children
}: SidebarNavParentProps) {
  const { locale } = useI18n();

  if (collapsed) {
    return (
      <SidebarNavItem
        href={href}
        label={label}
        icon={icon}
        active={active}
        collapsed
        comingSoon={comingSoon}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <div
        className={cn(
          "relative flex w-full min-w-0 items-stretch overflow-hidden rounded-lg",
          transitionBase,
          active
            ? cn(sidebarActiveIndicatorClass, "bg-orange-50 dark:bg-orange-500/12")
            : "hover:bg-slate-100 dark:hover:bg-slate-800/45"
        )}
      >
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={active && !expanded ? "page" : undefined}
          className={cn(
            "group flex min-h-11 w-full min-w-0 items-center justify-start gap-3 px-3 py-2.5 pe-10 text-start",
            sidebarNavTextClass(locale),
            transitionBase,
            active
              ? "font-medium text-orange-700 dark:text-orange-300"
              : "font-normal text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          )}
        >
          <SidebarNavIcon icon={icon} active={active} />
          <span className="min-w-0 max-w-[calc(100%-4.5rem)] truncate">{label}</span>
          {comingSoon ? <ComingSoonBadge subdued={active} /> : null}
        </Link>
        <button
          type="button"
          aria-label="Toggle section"
          aria-expanded={expanded}
          onClick={onToggleExpand}
          className={cn(
            "absolute inset-y-0 end-0 flex w-9 shrink-0 items-center justify-center text-slate-400",
            transitionBase,
            "hover:bg-slate-100/80 hover:text-slate-600 dark:hover:bg-slate-800/50 dark:hover:text-slate-200",
            active && "text-orange-600 dark:text-orange-400"
          )}
        >
          <ChevronDown
            size={16}
            strokeWidth={SIDEBAR_ICON_STROKE}
            className={cn("shrink-0 transition-transform duration-200", expanded && "rotate-180")}
          />
        </button>
      </div>
      {children}
    </div>
  );
}

interface SidebarNavChildProps {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}

export function SidebarNavChild({ href, label, active, onNavigate }: SidebarNavChildProps) {
  const { locale } = useI18n();

  return (
    <li className="w-full">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          sidebarNavItemClass(active, locale, { nested: true }),
          "ps-6",
          active && sidebarActiveIndicatorClass
        )}
      >
        <span className="min-w-0 max-w-full truncate">{label}</span>
      </Link>
    </li>
  );
}

export function SidebarSectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  const { locale } = useI18n();

  if (collapsed) return <div className="my-2 h-px bg-slate-200/60 dark:bg-slate-800/70" aria-hidden />;

  return (
    <p
      className={cn(
        "mb-1.5 mt-6 w-full px-3 text-start font-medium text-slate-400 first:mt-0 dark:text-slate-500",
        locale === "ar" ? "text-xs tracking-normal" : "text-[11px] uppercase tracking-wider"
      )}
    >
      {label}
    </p>
  );
}
