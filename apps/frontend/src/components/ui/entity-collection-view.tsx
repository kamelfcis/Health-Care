"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { AdvancedSearch, FilterOption } from "./AdvancedSearch";
import { DataPagination } from "./DataPagination";
import { ViewToggle } from "./ViewToggle";
import { PremiumTable } from "@/components/tables/premium-table";
import { useDebounce } from "@/hooks/use-debounce";
import { useListQueryState } from "@/hooks/use-list-query-state";

interface EntityCollectionViewProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  title: string;
  addButton?: React.ReactNode;
  belowHeader?: React.ReactNode;
  statusOptions: FilterOption[];
  getSearchText: (row: TData) => string;
  getStatus: (row: TData) => string;
  getDate?: (row: TData) => string | undefined;
  renderCard: (row: TData) => React.ReactNode;
  searchPlaceholder?: string;
  storageKey: string;
  /** When true, rows are already filtered (e.g. server-side); only pagination and view apply */
  skipLocalFiltering?: boolean;
  /** Replaces the default AdvancedSearch bar (e.g. custom patient filters) */
  searchSlot?: React.ReactNode;
  /** When true, table shows skeleton rows and pagination is hidden (e.g. initial server fetch) */
  listLoading?: boolean;
}

export function EntityCollectionView<TData>({
  data,
  columns,
  title,
  addButton,
  belowHeader,
  statusOptions,
  getSearchText,
  getStatus,
  getDate,
  renderCard,
  searchPlaceholder,
  storageKey,
  skipLocalFiltering = false,
  searchSlot,
  listLoading = false
}: EntityCollectionViewProps<TData>) {
  const { state, setQuery } = useListQueryState();
  const [searchInput, setSearchInput] = useState(state.q);
  const debouncedSearch = useDebounce(searchInput, 400);

  useEffect(() => {
    if (searchSlot) return;
    setQuery({ q: debouncedSearch, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, searchSlot]);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === "table" || stored === "cards") {
      setQuery({ view: stored });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const filtered = useMemo(() => {
    if (skipLocalFiltering) return data;
    return data.filter((row) => {
      const q = state.q.toLowerCase().trim();
      const searchPass = !q || getSearchText(row).toLowerCase().includes(q);
      const statusPass = state.status === "all" || getStatus(row) === state.status;

      const rowDate = getDate?.(row);
      const fromPass = !state.from || !rowDate || rowDate >= state.from;
      const toPass = !state.to || !rowDate || rowDate <= state.to;

      return searchPass && statusPass && fromPass && toPass;
    });
  }, [data, getDate, getSearchText, getStatus, skipLocalFiltering, state.from, state.q, state.status, state.to]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const page = Math.min(state.page, totalPages);
  const start = (page - 1) * state.pageSize;
  const paginated = filtered.slice(start, start + state.pageSize);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-brand-navy">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle value={state.view} onChange={(view) => setQuery({ view })} storageKey={storageKey} />
          {addButton}
        </div>
      </div>
      {belowHeader}

      {searchSlot ?? (
        <AdvancedSearch
          searchValue={searchInput}
          statusValue={state.status}
          fromValue={state.from}
          toValue={state.to}
          onSearchChange={setSearchInput}
          onStatusChange={(value) => setQuery({ status: value, page: 1 })}
          onFromChange={(value) => setQuery({ from: value, page: 1 })}
          onToChange={(value) => setQuery({ to: value, page: 1 })}
          onClear={() => {
            setSearchInput("");
            setQuery({ q: "", status: "all", from: "", to: "", page: 1 });
          }}
          statusOptions={statusOptions}
          placeholder={searchPlaceholder}
        />
      )}

      <PremiumTable
        columns={columns}
        data={paginated}
        view={state.view}
        cardRender={renderCard}
        loading={listLoading}
      />

      {!listLoading ? (
        <DataPagination
          page={page}
          pageSize={state.pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={(next) => setQuery({ page: next })}
          onPageSizeChange={(next) => setQuery({ pageSize: next, page: 1 })}
        />
      ) : null}
    </section>
  );
}
