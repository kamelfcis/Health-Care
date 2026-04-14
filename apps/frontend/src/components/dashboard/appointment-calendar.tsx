"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { appointmentService, AppointmentListItem } from "@/lib/appointment-service";
import { specialtyService, type ClinicSpecialtyItem, type SpecialtyCatalogItem } from "@/lib/specialty-service";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import { RippleButton } from "@/components/ui/ripple-button";

const CALENDAR_PAGE_SIZE = 3000;

const APPOINTMENT_STATUSES = ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function buildMonthGrid(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const pad = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = lastOfMonth.getDate();
  const totalCells = Math.ceil((pad + daysInMonth) / 7) * 7;
  const gridStart = new Date(year, month, 1 - pad);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + totalCells - 1);
  return { cells, pad, daysInMonth, gridStart, gridEnd };
}

function formatTime(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { hour: "2-digit", minute: "2-digit" }).format(d);
  } catch {
    return "";
  }
}

type Props = {
  clinicScopeId: string | undefined;
  isSuperAdmin: boolean;
};

export function DashboardAppointmentCalendar({ clinicScopeId, isSuperAdmin }: Props) {
  const { t, locale } = useI18n();
  const [view, setView] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [specialtyCode, setSpecialtyCode] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const year = view.getFullYear();
  const month = view.getMonth();
  const { cells, gridStart, gridEnd } = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const range = useMemo(
    () => ({
      startsFrom: toYmd(gridStart),
      startsTo: toYmd(gridEnd)
    }),
    [gridStart, gridEnd]
  );

  const specialtiesQuery = useQuery({
    queryKey: ["dashboard", "calendar-specialties", clinicScopeId ?? "all"],
    queryFn: async (): Promise<{ code: string; name: string; nameAr: string }[]> => {
      if (clinicScopeId) {
        const rows = await specialtyService.listMyClinicSpecialties(clinicScopeId);
        return (rows as ClinicSpecialtyItem[]).map((r) => ({
          code: r.specialty.code,
          name: r.specialty.name,
          nameAr: r.specialty.nameAr
        }));
      }
      const catalog = await specialtyService.listCatalog();
      return (catalog as SpecialtyCatalogItem[]).map((s) => ({
        code: s.code,
        name: s.name,
        nameAr: s.nameAr
      }));
    }
  });

  const appointmentsQuery = useQuery({
    queryKey: [
      "dashboard",
      "calendar-appointments",
      clinicScopeId ?? "all",
      range.startsFrom,
      range.startsTo,
      specialtyCode,
      statusFilter
    ],
    queryFn: () =>
      appointmentService.listResult(clinicScopeId, {
        startsFrom: range.startsFrom,
        startsTo: range.startsTo,
        ...(specialtyCode ? { specialtyCode } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        listPageSize: CALENDAR_PAGE_SIZE
      })
  });

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentListItem[]>();
    const list = appointmentsQuery.data?.data ?? [];
    for (const appt of list) {
      const d = new Date(appt.startsAt);
      const key = toYmd(d);
      const arr = map.get(key) ?? [];
      arr.push(appt);
      map.set(key, arr);
    }
    for (const arr of Array.from(map.values())) {
      arr.sort(
        (a: AppointmentListItem, b: AppointmentListItem) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      );
    }
    return map;
  }, [appointmentsQuery.data?.data]);

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { month: "long", year: "numeric" }).format(
        new Date(year, month, 1)
      ),
    [locale, year, month]
  );

  const weekdayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  const todayYmd = toYmd(new Date());

  const goPrev = () => setView(new Date(year, month - 1, 1));
  const goNext = () => setView(new Date(year, month + 1, 1));
  const goToday = () => {
    const n = new Date();
    setView(new Date(n.getFullYear(), n.getMonth(), 1));
  };

  const specLabel = (code: string, name: string, nameAr: string) => (locale === "ar" ? nameAr : name);

  return (
    <section className="card bg-white/80 p-5 shadow-soft backdrop-blur-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 p-2.5 text-white shadow-md">
            <CalendarDays size={22} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-brand-navy">{t("dashboard.calendar.title")}</h2>
            <p className="mt-0.5 text-sm text-slate-600">{t("dashboard.calendar.subtitle")}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RippleButton type="button" glow={false} className="h-10 border border-slate-200 bg-white !text-slate-700" onClick={goPrev}>
            <ChevronLeft size={18} />
          </RippleButton>
          <RippleButton type="button" glow={false} className="h-10 border border-slate-200 bg-white !text-slate-700" onClick={goToday}>
            {t("dashboard.calendar.today")}
          </RippleButton>
          <RippleButton type="button" glow={false} className="h-10 border border-slate-200 bg-white !text-slate-700" onClick={goNext}>
            <ChevronRight size={18} />
          </RippleButton>
          <span className="min-w-[10rem] text-center text-base font-semibold text-slate-800">{monthTitle}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          {t("nav.specialties")}
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            value={specialtyCode}
            onChange={(e) => setSpecialtyCode(e.target.value)}
            disabled={specialtiesQuery.isLoading}
          >
            <option value="">{t("dashboard.calendar.specialtyAll")}</option>
            {(specialtiesQuery.data ?? []).map((s) => (
              <option key={s.code} value={s.code}>
                {specLabel(s.code, s.name, s.nameAr)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-slate-600">
          {t("field.status")}
          <select
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t("dashboard.calendar.statusAll")}</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`) !== `status.${s}` ? t(`status.${s}`) : s}
              </option>
            ))}
          </select>
        </label>
        {isSuperAdmin && !clinicScopeId ? (
          <p className="text-xs text-amber-800">{t("dashboard.calendar.allClinicsHint")}</p>
        ) : null}
      </div>

      {appointmentsQuery.isError ? (
        <p className="mt-4 text-sm text-rose-600">{t("dashboard.calendar.loadError")}</p>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 p-2 sm:p-3">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 sm:text-sm">
            {weekdayLabels.map((label, wi) => (
              <div key={wi} className="py-2">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map(({ date, inMonth }) => {
              const key = toYmd(date);
              const dayAppointments = byDay.get(key) ?? [];
              const isToday = key === todayYmd;
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[5.5rem] rounded-xl border p-1.5 sm:min-h-[6.5rem] sm:p-2",
                    inMonth ? "border-slate-200/90 bg-white/90" : "border-transparent bg-slate-100/40 text-slate-400",
                    isToday && "ring-2 ring-orange-400 ring-offset-1"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className={cn("text-xs font-semibold sm:text-sm", inMonth ? "text-slate-800" : "text-slate-400")}>
                      {date.getDate()}
                    </span>
                    {dayAppointments.length > 0 ? (
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                        {dayAppointments.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayAppointments.slice(0, 4).map((appt) => {
                      const code = appt.specialty?.code ?? "—";
                      const hue = hueFromString(code);
                      const patient = appt.patient?.fullName ?? "—";
                      const timeStr = formatTime(appt.startsAt, locale);
                      const clinicName = appt.clinic?.name;
                      const titleParts = [timeStr, patient, appt.specialty ? (locale === "ar" ? appt.specialty.nameAr : appt.specialty.name) : ""];
                      if (clinicScopeId === undefined && clinicName) titleParts.push(clinicName);
                      const title = titleParts.filter(Boolean).join(" · ");
                      return (
                        <Link
                          key={appt.id}
                          href="/appointments"
                          title={title}
                          className="block truncate rounded-md px-1 py-0.5 text-[10px] font-medium leading-tight shadow-sm ring-1 ring-black/5 transition hover:brightness-95 sm:text-[11px]"
                          style={{
                            backgroundColor: `hsl(${hue}, 72%, 92%)`,
                            color: `hsl(${hue}, 45%, 22%)`
                          }}
                        >
                          <span className="font-semibold opacity-90">{timeStr}</span> {patient}
                        </Link>
                      );
                    })}
                    {dayAppointments.length > 4 ? (
                      <Link
                        href="/appointments"
                        className="text-center text-[10px] font-semibold text-orange-600 hover:underline"
                      >
                        +{dayAppointments.length - 4} {t("dashboard.calendar.more")}
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">{t("dashboard.calendar.legend")}</p>
    </section>
  );
}
