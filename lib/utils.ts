import { format, addDays, startOfWeek } from "date-fns";

export function getWeekDays(startDate: Date): Date[] {
  const monday = startOfWeek(startDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return format(d, "yyyy-MM-dd");
}

export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return format(d, "EEE MM/dd");
}

export function formatTime(time?: string): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${ampm}`;
}

export function shiftDurationHours(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh + em / 60) - (sh + sm / 60);
  return diff < 0 ? diff + 24 : diff;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    ready:       "bg-emerald-100 text-emerald-800",
    issue:       "bg-amber-100 text-amber-800",
    maintenance: "bg-sky-100 text-sky-800",
    disabled:    "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

export function statusDot(status: string): string {
  const map: Record<string, string> = {
    ready:       "bg-emerald-500",
    issue:       "bg-amber-500",
    maintenance: "bg-sky-500",
    disabled:    "bg-gray-400",
  };
  return map[status] ?? "bg-gray-400";
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function currencyFmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}