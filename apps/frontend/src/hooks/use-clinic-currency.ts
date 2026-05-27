"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/currency-format";
import { clinicService, type ClinicItem } from "@/lib/clinic-service";
import { storage } from "@/lib/storage";

const FALLBACK_CURRENCY = "USD";
const FALLBACK_COUNTRY = "US";

export const CLINIC_ME_QUERY_KEY = ["clinic", "me"] as const;

export type UseClinicCurrencyOptions = {
  /** SuperAdmin: selected clinic id, or `"all"` / undefined for aggregate */
  clinicId?: string | null;
  /** Pre-fetched clinics list (avoids duplicate query) */
  clinics?: ClinicItem[];
};

export function useClinicCurrency(options: UseClinicCurrencyOptions = {}) {
  const { clinicId, clinics: clinicsProp } = options;
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);

  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);

  const isSuperAdmin = currentUser?.role === "SuperAdmin";

  const myClinicQuery = useQuery({
    queryKey: [...CLINIC_ME_QUERY_KEY, currentUser?.role ?? "none"],
    queryFn: () => clinicService.getMyClinic(),
    enabled: !!currentUser && !isSuperAdmin
  });

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-filter"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin && clinicsProp === undefined
  });

  const clinics = clinicsProp ?? clinicsQuery.data ?? [];

  const resolved = useMemo(() => {
    if (isSuperAdmin) {
      if (!clinicId || clinicId === "all") {
        return { currencyCode: FALLBACK_CURRENCY, countryCode: FALLBACK_COUNTRY };
      }
      const selected = clinics.find((c) => c.id === clinicId);
      return {
        currencyCode: (selected?.currencyCode ?? FALLBACK_CURRENCY).toUpperCase(),
        countryCode: (selected?.countryCode ?? FALLBACK_COUNTRY).toUpperCase()
      };
    }
    const clinic = myClinicQuery.data;
    return {
      currencyCode: (clinic?.currencyCode ?? FALLBACK_CURRENCY).toUpperCase(),
      countryCode: (clinic?.countryCode ?? FALLBACK_COUNTRY).toUpperCase()
    };
  }, [clinicId, clinics, isSuperAdmin, myClinicQuery.data]);

  const formatMoney = useCallback(
    (amount: number) => formatCurrency(amount, resolved.currencyCode, resolved.countryCode),
    [resolved.countryCode, resolved.currencyCode]
  );

  const isReady = isSuperAdmin
    ? clinicsProp !== undefined || clinicsQuery.isSuccess
    : myClinicQuery.isSuccess || myClinicQuery.isError;

  return {
    currencyCode: resolved.currencyCode,
    countryCode: resolved.countryCode,
    formatMoney,
    isReady
  };
}
