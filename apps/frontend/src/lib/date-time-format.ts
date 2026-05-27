/** Appointment-style datetime: `3/28/2026, 9:56:00 AM` or Arabic `… صباحا` / `… مساءا`. */
export function formatDateTimeDisplay(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";

  if (locale === "ar") {
    const formatted = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(d);
    return formatted.replace(/\s*AM$/i, " صباحا").replace(/\s*PM$/i, " مساءا");
  }

  return d.toLocaleString();
}
