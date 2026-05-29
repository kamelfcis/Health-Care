"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Bell, ChevronDown, Loader2, LogOut, Menu, Search, User } from "lucide-react";
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
import { useDebounce } from "@/hooks/use-debounce";
import { searchService } from "@/lib/search-service";

export function TopNavbar() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toggleCollapsed, openMobile } = useSidebar();
  const { t } = useI18n();
  const router = useRouter();
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 350);

  useEffect(() => {
    setUser(storage.getUser());
    setMounted(true);
  }, []);

  const searchQuery = useQuery({
    queryKey: ["global-search", debouncedSearch, user?.clinicId ?? "none"],
    queryFn: () =>
      searchService.global(
        debouncedSearch,
        user?.role === "SuperAdmin" ? undefined : user?.clinicId
      ),
    enabled: mounted && debouncedSearch.trim().length >= 2
  });

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
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
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/80 bg-white/90 p-4 shadow-soft backdrop-blur-xl dark:border-transparent dark:bg-sidebar/90 dark:shadow-elevated-sm">
      <div className="flex items-center gap-2">
        {mounted && clinicImageSrc ? (
          <div className="hidden h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-white md:block dark:border-transparent dark:bg-surface-raised dark:shadow-elevated-sm">
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
        <button className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-transparent dark:bg-surface-raised dark:text-foreground/90 dark:shadow-elevated-sm md:hidden" onClick={openMobile}>
          <Menu size={16} />
        </button>
        <button className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 dark:border-transparent dark:bg-surface-raised dark:text-foreground/90 dark:shadow-elevated-sm md:inline-flex" onClick={toggleCollapsed}>
          <Menu size={16} />
        </button>
      </div>
      <div ref={searchWrapRef} className="relative mx-3 hidden max-w-xl flex-1 md:block">
        <motion.div whileHover={{ scale: 1.01 }} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2.5 dark:border-transparent dark:bg-surface-raised/90 dark:shadow-elevated-sm">
          <Search size={15} className="shrink-0 text-slate-400 dark:text-muted-foreground" />
          <input
            placeholder={t("nav.search.placeholder")}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-foreground dark:placeholder:text-muted-foreground"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            aria-expanded={searchOpen}
            aria-autocomplete="list"
          />
          {searchQuery.isFetching ? <Loader2 size={15} className="shrink-0 animate-spin text-slate-400" /> : null}
        </motion.div>
        {searchOpen && searchInput.trim().length > 0 ? (
          <div className="absolute start-0 end-0 top-[calc(100%+6px)] z-50 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 text-sm shadow-lg dark:border-transparent dark:bg-popover dark:shadow-elevated-lg">
            {debouncedSearch.trim().length < 2 ? (
              <p className="px-3 py-2 text-slate-500">{t("nav.search.typeMore")}</p>
            ) : searchQuery.isError ? (
              <p className="px-3 py-2 text-rose-600">{t("common.noData")}</p>
            ) : !searchQuery.data ||
              (!searchQuery.data.patients.length &&
                !searchQuery.data.doctors.length &&
                !searchQuery.data.invoices.length) ? (
              <p className="px-3 py-2 text-slate-500">{t("nav.search.noResults")}</p>
            ) : (
              <div className="space-y-3 px-1">
                {searchQuery.data.patients.length ? (
                  <div>
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("nav.search.section.patients")}</p>
                    <ul className="space-y-0.5">
                      {searchQuery.data.patients.map((hit) => (
                        <li key={`p-${hit.id}`}>
                          <button
                            type="button"
                            className="w-full rounded-lg px-2 py-1.5 text-start hover:bg-orange-50 dark:hover:bg-accent"
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchInput("");
                              router.push(hit.href);
                            }}
                          >
                            <span className="block font-medium text-slate-800 dark:text-foreground">{hit.title}</span>
                            {hit.subtitle ? <span className="block text-xs text-slate-500 dark:text-muted-foreground">{hit.subtitle}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {searchQuery.data.doctors.length ? (
                  <div>
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("nav.search.section.doctors")}</p>
                    <ul className="space-y-0.5">
                      {searchQuery.data.doctors.map((hit) => (
                        <li key={`d-${hit.id}`}>
                          <button
                            type="button"
                            className="w-full rounded-lg px-2 py-1.5 text-start hover:bg-orange-50 dark:hover:bg-accent"
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchInput("");
                              router.push(hit.href);
                            }}
                          >
                            <span className="block font-medium text-slate-800 dark:text-foreground">{hit.title}</span>
                            {hit.subtitle ? <span className="block text-xs text-slate-500 dark:text-muted-foreground">{hit.subtitle}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {searchQuery.data.invoices.length ? (
                  <div>
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{t("nav.search.section.invoices")}</p>
                    <ul className="space-y-0.5">
                      {searchQuery.data.invoices.map((hit) => (
                        <li key={`i-${hit.id}`}>
                          <button
                            type="button"
                            className="w-full rounded-lg px-2 py-1.5 text-start hover:bg-orange-50 dark:hover:bg-accent"
                            onClick={() => {
                              setSearchOpen(false);
                              setSearchInput("");
                              router.push(hit.href);
                            }}
                          >
                            <span className="block font-medium text-slate-800 dark:text-foreground">{hit.title}</span>
                            {hit.subtitle ? <span className="block text-xs text-slate-500 dark:text-muted-foreground">{hit.subtitle}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <div className="hidden md:block">
          <LanguageToggle />
        </div>
        <button
          className={cn(
            "relative hidden rounded-xl border border-slate-200 bg-white/80 p-2 text-slate-500 transition hover:shadow-soft dark:border-transparent dark:bg-surface-raised dark:text-muted-foreground dark:shadow-elevated-sm md:inline-flex"
          )}
        >
          <Bell size={16} />
          <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-orange-500" />
        </button>
        <div ref={accountMenuRef} className="relative hidden md:block">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-2 py-1.5 text-left text-slate-600 transition hover:shadow-soft dark:border-transparent dark:bg-surface-raised/90 dark:text-foreground/90 dark:shadow-elevated-sm"
            onClick={() => setAccountOpen((prev) => !prev)}
          >
            <div className="text-right">
              <p className="text-sm font-medium text-brand-navy dark:text-foreground">
                {mounted ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || t("common.guest") : t("common.guest")}
              </p>
              <p className="text-xs text-slate-500 dark:text-muted-foreground">{mounted ? user?.role ?? t("common.guest") : t("common.guest")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white/90 p-2 text-slate-500 dark:border-transparent dark:bg-muted dark:text-muted-foreground">
              <AvatarIcon />
            </div>
            <ChevronDown size={15} className={cn("transition", accountOpen && "rotate-180")} />
          </button>

          {accountOpen ? (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-soft dark:border-transparent dark:bg-popover dark:shadow-elevated-lg">
              <button
                type="button"
                className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-orange-50 dark:text-foreground dark:hover:bg-accent"
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
