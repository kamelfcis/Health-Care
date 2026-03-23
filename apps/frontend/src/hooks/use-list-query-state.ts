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
}

const defaultState: ListQueryState = {
  page: 1,
  pageSize: 10,
  q: "",
  status: "all",
  from: "",
  to: "",
  view: "table"
};

export function useListQueryState() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = useMemo<ListQueryState>(() => {
    const page = Math.max(1, Number(searchParams.get("page") ?? defaultState.page));
    const pageSize = [10, 20, 50, 100].includes(Number(searchParams.get("pageSize")))
      ? Number(searchParams.get("pageSize"))
      : defaultState.pageSize;
    const viewParam = searchParams.get("view");
    const view: "table" | "cards" =
      viewParam === "cards"
        ? "cards"
        : viewParam === "table"
          ? "table"
          : pathname === "/patients" || pathname === "/appointments"
            ? "cards"
            : "table";

    return {
      page,
      pageSize,
      q: searchParams.get("q") ?? "",
      status: searchParams.get("status") ?? "all",
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
      view
    };
  }, [pathname, searchParams]);

  const setQuery = (updates: Partial<ListQueryState>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
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
