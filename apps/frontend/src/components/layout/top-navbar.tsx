"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Bell, ChevronDown, LogOut, Menu, Search, User } from "lucide-react";
import { AvatarIcon } from "@radix-ui/react-icons";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { storage } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { AuthUser } from "@/types";
import { useI18n } from "@/components/providers/i18n-provider";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { authService } from "@/lib/auth-service";
import { toast } from "sonner";
import { useSidebar } from "./sidebar-context";
import { clinicService } from "@/lib/clinic-service";

export function TopNavbar() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toggleCollapsed, openMobile } = useSidebar();
  const { t } = useI18n();
  const router = useRouter();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUser(storage.getUser());
    setMounted(true);
  }, []);

  const clinicsQuery = useQuery({
    queryKey: ["top-navbar", "clinics", user?.role ?? "none", user?.clinicId ?? "none"],
    queryFn: async () => {
      if (user?.role === "SuperAdmin") {
        return [];
      }
      if (!user?.clinicId) {
        return [];
      }
      const clinic = await clinicService.getMyClinic();
      return [clinic];
    },
    enabled: mounted && !!user
  });

  const clinicImagePath =
    user?.role === "SuperAdmin"
      ? null
      : clinicsQuery.data?.find((clinic) => clinic.id === user?.clinicId)?.imageUrl ?? null;
  const apiOrigin = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api").replace(/\/api\/?$/, "");
  const clinicImageSrc =
    clinicImagePath && clinicImagePath.startsWith("http") ? clinicImagePath : clinicImagePath ? `${apiOrigin}${clinicImagePath}` : null;

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

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      toast.error(t("common.logoutFailed"));
    } finally {
      queryClient.clear();
      storage.clearSession();
      router.replace("/login");
    }
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/90 p-4 shadow-soft backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-950/85">
      <div className="flex items-center gap-2">
        {mounted && clinicImageSrc ? (
          <div className="hidden h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-slate-700 dark:bg-slate-900">
            <Image
              src={clinicImageSrc}
              alt="Clinic logo"
              width={40}
              height={40}
              unoptimized
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 md:hidden" onClick={openMobile}>
          <Menu size={16} />
        </button>
        <button className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 md:inline-flex" onClick={toggleCollapsed}>
          <Menu size={16} />
        </button>
      </div>
      <motion.div whileHover={{ scale: 1.01 }} className="mx-3 hidden flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80 md:flex">
        <Search size={15} className="text-slate-400 dark:text-slate-500" />
        <input
          placeholder={t("nav.search.placeholder")}
          className="w-72 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </motion.div>
      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <div className="hidden md:block">
          <LanguageToggle />
        </div>
        <button
          className={cn(
            "relative hidden rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-500 transition hover:shadow-soft dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 md:inline-flex"
          )}
        >
          <Bell size={16} />
          <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-orange-500" />
        </button>
        <div ref={accountMenuRef} className="relative hidden md:block">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-2 py-1.5 text-left text-slate-600 transition hover:shadow-soft dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-200"
            onClick={() => setAccountOpen((prev) => !prev)}
          >
            <div className="text-right">
              <p className="text-sm font-medium text-brand-navy dark:text-slate-100">
                {mounted ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || t("common.guest") : t("common.guest")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{mounted ? user?.role ?? t("common.guest") : t("common.guest")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <AvatarIcon />
            </div>
            <ChevronDown size={15} className={cn("transition", accountOpen && "rotate-180")} />
          </button>

          {accountOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-soft dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => {
                  setAccountOpen(false);
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
      </div>
    </header>
  );
}
