import { format, addDays, startOfWeek } from "date-fns";

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getWeekDays(startDate: Date): Date[] {
  const monday = startOfWeek(startDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Returns YYYY-MM-DD regardless of timezone (treats date as local). */
export function formatDate(date: Date | string): string {
  if (typeof date === "string") return date.slice(0, 10);
  return format(date, "yyyy-MM-dd");
}

export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  return format(d, "EEE MM/dd");
}

export function formatTime(time?: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${m} ${ampm}`;
}

export function todayISO(): string {
  return formatDate(new Date());
}

/** Returns current Monday as Date (local time, midnight). */
export function thisMonday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Shift / time math ───────────────────────────────────────────────────────

export function shiftDurationHours(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = eh + em / 60 - (sh + sm / 60);
  return diff < 0 ? diff + 24 : diff; // overnight support
}

// ─── Equipment status ─────────────────────────────────────────────────────────

export type EquipmentStatus = "ready" | "issue" | "maintenance" | "disabled";

export function statusBadgeClass(status: EquipmentStatus | string): string {
  switch (status) {
    case "ready":       return "badge-green";
    case "issue":       return "badge-amber";
    case "maintenance": return "badge-blue";
    case "disabled":    return "badge-gray";
    default:            return "badge-gray";
  }
}

// ─── Currency ────────────────────────────────────────────────────────────────

export function formatCurrency(value: number | string): string {
  return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Class merging ───────────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
