"use client";

import { Bell, ChevronDown, LogOut, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { AuthUser } from "@/types";

interface SidebarAccountProps {
  user: AuthUser | null;
  open: boolean;
  onToggle: () => void;
  onLogout: () => void;
  onNavigate?: () => void;
  menuRef: React.Ref<HTMLDivElement>;
}

export function SidebarAccount({ user, open, onToggle, onLogout, onNavigate, menuRef }: SidebarAccountProps) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const displayName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || t("common.guest");

  return (
    <div ref={menuRef} className="mt-auto w-full shrink-0 border-t border-slate-200/50 pt-3 md:hidden dark:border-slate-800/50">
      <div className="mb-2.5 flex w-full items-center justify-between gap-2 rounded-xl bg-slate-50/70 p-1.5 dark:bg-slate-900/35">
        <ThemeToggle />
        <LanguageToggle />
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/50"
          aria-label={t("nav.notifications")}
        >
          <Bell size={18} strokeWidth={1.75} />
          <span className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500" />
        </button>
      </div>
      <button
        type="button"
        className="flex w-full min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-slate-600 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/50"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1 text-start">
          <p className={cn("truncate font-medium text-slate-900 dark:text-slate-50", locale === "ar" ? "text-[15px]" : "text-sm")}>
            {displayName}
          </p>
          <p className={cn("truncate text-slate-500 dark:text-slate-400", locale === "ar" ? "text-xs" : "text-[11px]")}>
            {user?.role ?? t("common.guest")}
          </p>
        </div>
        <ChevronDown size={16} strokeWidth={1.75} className={cn("shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-1.5 w-full overflow-hidden rounded-xl bg-slate-50/80 p-1 dark:bg-slate-900/50">
          <button
            type="button"
            className="flex w-full min-h-10 items-center justify-start gap-2 rounded-lg px-3 py-2.5 text-start text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/50"
            onClick={() => {
              onNavigate?.();
              router.push("/profile");
            }}
          >
            <User size={16} strokeWidth={1.75} />
            <span className={locale === "ar" ? "text-[15px]" : "text-sm"}>{t("common.profile")}</span>
          </button>
          <button
            type="button"
            className="flex w-full min-h-10 items-center justify-start gap-2 rounded-lg px-3 py-2.5 text-start text-red-600 transition-colors duration-200 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={onLogout}
          >
            <LogOut size={16} strokeWidth={1.75} />
            <span className={locale === "ar" ? "text-[15px]" : "text-sm"}>{t("common.logout")}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
