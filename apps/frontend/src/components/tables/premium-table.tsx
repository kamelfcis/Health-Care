"use client";

import { useMemo, useState } from "react";
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/i18n-provider";

function PremiumTableSkeleton({ view, columnCount }: { view: "table" | "cards"; columnCount: number }) {
  const cols = Math.min(Math.max(columnCount, 4), 10);
  const rowCount = 8;

  if (view === "table") {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-[7.5rem] rounded-xl" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-soft backdrop-blur-sm">
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white/95">
                <tr>
                  {Array.from({ length: cols }).map((_, i) => (
                    <th key={i} className="border-b border-slate-100 px-4 py-3 text-left">
                      <Skeleton className="h-4 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }).map((_, ri) => (
                  <tr key={ri} className={cn("border-b border-slate-100", ri % 2 === 0 ? "bg-white/80" : "bg-slate-50/30")}>
                    {Array.from({ length: cols }).map((_, ci) => (
                      <td key={ci} className="px-4 py-3">
                        <Skeleton className={cn("h-4", ci === 0 ? "w-32" : "w-24")} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-[7.5rem] rounded-xl" />
      </div>
      <div className="grid auto-rows-max items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="relative self-start overflow-hidden rounded-2xl border border-orange-100/70 border-l-4 border-l-orange-500 bg-gradient-to-br from-white via-orange-50/40 to-cyan-50/30 p-4 shadow-soft"
          >
            <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-orange-200/30 blur-xl" />
            <div className="relative space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-5 w-[70%] rounded-lg" />
                <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
              </div>
              <Skeleton className="h-3 w-24" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-[80%]" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-9 flex-1 rounded-xl" />
                <Skeleton className="h-9 w-9 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PremiumTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  loading?: boolean;
  emptyMessage?: string;
  cardRender: (row: TData) => React.ReactNode;
  view: "table" | "cards";
}

export function PremiumTable<TData>({
  columns,
  data,
  loading = false,
  emptyMessage,
  cardRender,
  view
}: PremiumTableProps<TData>) {
  const { t } = useI18n();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumns, setShowColumns] = useState(false);

  const sortableColumns = useMemo(
    () => columns.filter((column) => "accessorKey" in column && !!column.header),
    [columns]
  );

  const skeletonColumnCount = useMemo(
    () => Math.max(sortableColumns.length || columns.length, 4),
    [sortableColumns.length, columns.length]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  if (loading) {
    return (
      <div className="animate-in fade-in duration-200" aria-busy="true" aria-label={t("common.loading")}>
        <PremiumTableSkeleton view={view} columnCount={skeletonColumnCount} />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 py-16 text-center text-slate-500">
        {emptyMessage ?? t("common.noData")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative flex justify-end">
        <button
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 transition hover:bg-orange-50"
          onClick={() => setShowColumns((value) => !value)}
        >
          <SlidersHorizontal size={15} />
          {t("common.filters")}
        </button>
        <AnimatePresence>
          {showColumns ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute right-0 top-11 z-20 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-soft"
            >
              {sortableColumns.map((column) => {
                const key = String((column as { accessorKey?: string }).accessorKey ?? "");
                const checked = table.getColumn(key)?.getIsVisible() ?? true;
                return (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-orange-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => table.getColumn(key)?.toggleVisibility(event.target.checked)}
                    />
                    {String(column.header)}
                  </label>
                );
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {view === "table" ? (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 shadow-soft backdrop-blur-sm"
          >
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white/95">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="border-b border-slate-100 px-4 py-3 text-left font-medium text-slate-600">
                          {header.isPlaceholder ? null : (
                            <button
                              className="inline-flex items-center gap-1"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() ? (
                                <ArrowUpDown
                                  size={14}
                                  className={cn(
                                    "transition",
                                    header.column.getIsSorted() ? "text-orange-500" : "text-slate-400"
                                  )}
                                />
                              ) : null}
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row, idx) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={cn(
                        "border-b border-slate-100 transition hover:bg-orange-50/50",
                        idx % 2 === 0 ? "bg-white/80" : "bg-slate-50/30"
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 text-slate-700">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="cards"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="grid auto-rows-max items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {data.map((row, idx) => (
              <motion.div
                key={idx}
                layout
                whileHover={{ y: -4 }}
                className="self-start rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-soft backdrop-blur-sm"
              >
                {cardRender(row)}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
