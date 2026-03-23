"use client";
import { useEffect, useMemo, useState } from "react";

import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { EntityCollectionView } from "@/components/ui/entity-collection-view";
import { RippleButton } from "@/components/ui/ripple-button";
import { useI18n } from "@/components/providers/i18n-provider";
import { clinicService } from "@/lib/clinic-service";
import { formatCurrency } from "@/lib/currency-format";
import { paymentService } from "@/lib/payment-service";
import { storage } from "@/lib/storage";
import { RoleGate } from "@/components/auth/role-gate";

type PaymentRow = {
  clinicId: string;
  invoice: string;
  amount: string;
  method: string;
  status: string;
  date: string;
};

export default function PaymentsPage() {
  const { t } = useI18n();
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof storage.getUser>>(null);
  useEffect(() => {
    setCurrentUser(storage.getUser());
  }, []);
  const isSuperAdmin = currentUser?.role === "SuperAdmin";
  const [selectedClinicId, setSelectedClinicId] = useState<string>("all");

  const clinicsQuery = useQuery({
    queryKey: ["clinics", "for-filter"],
    queryFn: () => clinicService.list(),
    enabled: isSuperAdmin
  });
  const myClinicQuery = useQuery({
    queryKey: ["settings", "clinic-me", currentUser?.role ?? "none"],
    queryFn: () => clinicService.getMyClinic(),
    enabled: !!currentUser && currentUser.role !== "SuperAdmin"
  });

  const clinicCurrencyById = useMemo(() => {
    const map = new Map<string, string>();
    for (const clinic of clinicsQuery.data ?? []) {
      if (clinic.id) {
        map.set(clinic.id, (clinic.currencyCode ?? "USD").toUpperCase());
      }
    }
    if (myClinicQuery.data?.id) {
      map.set(myClinicQuery.data.id, (myClinicQuery.data.currencyCode ?? "USD").toUpperCase());
    }
    return map;
  }, [clinicsQuery.data, myClinicQuery.data]);

  const paymentsQuery = useQuery({
    queryKey: ["payments", { page: 1, pageSize: 500, clinicId: selectedClinicId }],
    queryFn: () => paymentService.list(selectedClinicId === "all" ? undefined : selectedClinicId)
  });

  const data: PaymentRow[] = useMemo(
    () =>
      paymentsQuery.data?.map((item) => ({
        clinicId: item.clinicId,
        invoice: item.invoice?.invoiceNumber ?? "-",
        amount: formatCurrency(item.amount, clinicCurrencyById.get(item.clinicId) ?? "USD"),
        method: item.method,
        status: item.status,
        date: String(item.createdAt).slice(0, 10)
      })) ?? [],
    [paymentsQuery.data, clinicCurrencyById]
  );

  const statuses = useMemo(() => Array.from(new Set(data.map((item) => item.status))), [data]);
  const statusLabel = (status: string) => {
    const key = `status.${status}`;
    const translated = t(key);
    return translated === key ? status : translated;
  };

  const columns: ColumnDef<PaymentRow>[] = [
    { header: "Invoice", accessorKey: "invoice" },
    { header: "Amount", accessorKey: "amount" },
    { header: "Method", accessorKey: "method" },
    {
      header: t("field.status"),
      id: "status",
      cell: ({ row }) => statusLabel(row.original.status)
    },
    { header: "Date", accessorKey: "date" }
  ];

  return (
    <RoleGate requiredPermissions={["payments.read"]} fallback={<div className="card p-6 text-sm text-slate-500">{t("common.notAllowed")}</div>}>
    <AppShell>
      {isSuperAdmin ? (
        <section className="mb-4 card bg-white/80 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-600">{t("dashboard.clinicScope")}</p>
            <select
              className="h-11 min-w-[220px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30"
              value={selectedClinicId}
              onChange={(event) => setSelectedClinicId(event.target.value)}
            >
              <option value="all">{t("common.allClinics")}</option>
              {(clinicsQuery.data ?? []).map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
        </section>
      ) : null}
      {paymentsQuery.isLoading ? (
        <div className="card p-6 text-sm text-slate-500">{t("payments.loading")}</div>
      ) : (
        <EntityCollectionView
          title={t("nav.payments")}
          columns={columns}
          data={data}
          storageKey="payment-view"
          statusOptions={[
            { label: t("common.allStatuses"), value: "all" },
            ...statuses.map((status) => ({ label: statusLabel(status), value: status }))
          ]}
          searchPlaceholder={`${t("common.search")} ${t("nav.payments")}`}
          addButton={<RippleButton>{`+ ${t("nav.payments")}`}</RippleButton>}
          getSearchText={(row) => `${row.invoice} ${row.amount} ${row.method} ${row.status} ${row.date}`}
          getStatus={(row) => row.status}
          getDate={(row) => row.date}
          renderCard={(row) => (
            <div className="space-y-1">
              <h3 className="font-semibold text-slate-900">{row.invoice}</h3>
              <p className="text-sm text-slate-500">{row.amount}</p>
              <p className="text-xs text-slate-500">{row.method}</p>
              <p className="text-xs text-orange-600">{statusLabel(row.status)}</p>
            </div>
          )}
        />
      )}
    </AppShell>
    </RoleGate>
  );
}
