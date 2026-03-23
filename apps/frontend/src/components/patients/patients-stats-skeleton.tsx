"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function PatientsStatsSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="card flex flex-col justify-between p-5 hover:shadow-premium bg-gradient-to-br from-white to-orange-50/60"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <div className="mt-2">
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      ))}
    </>
  );
}
