"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface ListQueryState {
  page: number;
  pageSize: number;
  q: string;
  status: string;
  from: string;
  to: string;
  view: "table" | "cards";
  /** Payments: payment method filter */
  method: string;
  /** Billing: created_desc | due_asc */
  sort: string;
  /** Billing: pending + overdue only */
  openOnly: boolean;
}

const defaultState: ListQueryState = {
  page: 1,
  pageSize: 20,
  q: "",
  status: "all",
  from: "",
  to: "",
  view: "table",
  method: "all",
  sort: "",
  openOnly: false
};

export function useListQueryState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = useMemo<ListQueryState>(() => {
    const page = Math.max(1, Number(searchParams.get("page") ?? defaultState.page));
    const rawPs = Number(searchParams.get("pageSize"));
    const pageSize = [10, 20, 50, 100].includes(rawPs) ? rawPs : defaultState.pageSize;
    const viewParam = searchParams.get("view");
    const view: "table" | "cards" =
      viewParam === "cards"
        ? "cards"
        : viewParam === "table"
          ? "table"
          : pathname === "/patients" || pathname === "/appointments"
            ? "cards"
            : "table";

    const sortParam = searchParams.get("sort") ?? "";
    const sort = sortParam === "due_asc" ? "due_asc" : "";

    return {
      page,
      pageSize,
      q: searchParams.get("q") ?? "",
      status: searchParams.get("status") ?? "all",
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
      view,
      method: searchParams.get("method") ?? "all",
      sort,
      openOnly: searchParams.get("open") === "1"
    };
  }, [pathname, searchParams]);

  const setQuery = (updates: Partial<ListQueryState>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (key === "openOnly") {
        if (value) params.set("open", "1");
        else params.delete("open");
        return;
      }
      if (value === undefined || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return { state, setQuery };
}
