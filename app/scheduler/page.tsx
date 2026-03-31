"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addWeeks, format, isToday, startOfWeek, subWeeks } from "date-fns";
import { Employee, Note, Shift } from "@/lib/types";
import { formatDate, formatTime, getWeekDays, shiftDurationHours } from "@/lib/utils";
import Modal from "@/components/Modal";

type ShiftMap = Record<string, Shift>;
type FilterMode = "all" | "scheduled" | "unscheduled" | "dayoff";
type ShiftEditor = Partial<Shift> & { employee_name?: string };

function shiftKey(empId: number, date: string) {
  return `${empId}__${date}`;
}

function SkeletonGrid({ days }: { days: Date[] }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-gray-100">
          <td className="sticky left-0 border-r border-gray-100 bg-white px-4 py-3">
            <div className="mb-1 h-3.5 w-28 rounded-full bg-gray-100" />
            <div className="h-2.5 w-16 rounded-full bg-gray-100" />
          </td>
          {days.map((_, j) => (
            <td key={j} className="px-2 py-2">
              <div className="h-12 w-full rounded-lg bg-gray-100" />
            </td>
          ))}
          {Array.from({ length: 4 }).map((_, j) => (
            <td key={`summary-${j}`} className="px-2 py-2">
              <div className="h-12 rounded-lg bg-gray-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function employeeWeeklyStats(employee: Employee, days: Date[], shiftMap: ShiftMap) {
  const shifts = days
    .map((day) => shiftMap[shiftKey(employee.id, formatDate(day))])
    .filter((shift): shift is Shift => Boolean(shift));

  const workedHours = shifts
    .filter((shift) => !shift.is_day_off)
    .reduce((sum, shift) => sum + shiftDurationHours(shift.start_time, shift.end_time), 0);

  const scheduledCount = shifts.filter((shift) => !shift.is_day_off).length;
  const dayOffCount = shifts.filter((shift) => shift.is_day_off).length;

  return {
    workedHours,
    regularHours: Math.min(workedHours, 40),
    overtimeHours: Math.max(workedHours - 40, 0),
    scheduledCount,
    dayOffCount,
  };
}

export default function SchedulerPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const days = getWeekDays(weekStart);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftMap, setShiftMap] = useState<ShiftMap>({});
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [actionMessage, setActionMessage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editShift, setEditShift] = useState<ShiftEditor>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [noteDraft, setNoteDraft] = useState({ date: "", type: "daily", content: "" });

  const load = useCallback(async (ws: Date) => {
    setLoading(true);
    setError("");
    const start = formatDate(getWeekDays(ws)[0]);
    const end = formatDate(getWeekDays(ws)[6]);
    try {
      const [empRes, shiftRes, noteRes] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/shifts?start=${start}&end=${end}`),
        fetch(`/api/notes?start=${start}&end=${end}`),
      ]);
      if (!empRes.ok || !shiftRes.ok || !noteRes.ok) throw new Error("Failed to load scheduler data");

      const [emps, shifts, noteRows]: [Employee[], Shift[], Note[]] = await Promise.all([
        empRes.json(),
        shiftRes.json(),
        noteRes.json(),
      ]);

      const map: ShiftMap = {};
      for (const shift of shifts) map[shiftKey(shift.employee_id, shift.date)] = shift;

      setEmployees(emps.filter((employee) => employee.active));
      setShiftMap(map);
      setNotes(noteRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(weekStart);
  }, [weekStart, load]);

  useEffect(() => {
    if (!actionMessage) return;
    const timeout = window.setTimeout(() => setActionMessage(""), 2500);
    return () => window.clearTimeout(timeout);
  }, [actionMessage]);

  const visibleEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const stats = employeeWeeklyStats(employee, days, shiftMap);
      const matchesSearch =
        !term ||
        `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(term) ||
        employee.worker_type?.toLowerCase().includes(term);

      const matchesFilter =
        filterMode === "all" ||
        (filterMode === "scheduled" && stats.scheduledCount > 0) ||
        (filterMode === "unscheduled" && stats.scheduledCount === 0 && stats.dayOffCount === 0) ||
        (filterMode === "dayoff" && stats.dayOffCount > 0);

      return matchesSearch && matchesFilter;
    });
  }, [days, employees, filterMode, search, shiftMap]);

  function openCell(employee: Employee, day: Date) {
    const date = formatDate(day);
    const existing = shiftMap[shiftKey(employee.id, date)];
    setEditShift({
      ...(existing ?? {}),
      employee_id: employee.id,
      date,
      employee_name: `${employee.first_name} ${employee.last_name}`,
      start_time: existing?.start_time ?? "07:00",
      end_time: existing?.end_time ?? "15:30",
      is_day_off: existing?.is_day_off ?? false,
    });
    setSaveError("");
    setModalOpen(true);
  }

  function openQuickAddShift() {
    const firstEmployee = visibleEmployees[0] ?? employees[0];
    if (!firstEmployee) return;
    openCell(firstEmployee, days[0]);
  }

  function openNoteModal() {
    setNoteDraft({ date: formatDate(days[0]), type: "daily", content: "" });
    setNoteError("");
    setNoteModalOpen(true);
  }

  async function saveShift() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editShift),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Save failed");
      }
      setModalOpen(false);
      setActionMessage("Shift saved");
      load(weekStart);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveNote() {
    setNoteSaving(true);
    setNoteError("");
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteDraft),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to save note");
      }
      setNoteModalOpen(false);
      setActionMessage("Note added");
      load(weekStart);
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setNoteSaving(false);
    }
  }

  async function copyPrevWeek() {
    const prevStart = formatDate(subWeeks(weekStart, 1));
    const prevEnd = formatDate(addDays(subWeeks(weekStart, 1), 6));
    const res = await fetch(`/api/shifts?start=${prevStart}&end=${prevEnd}`);
    const prevShifts: Shift[] = await res.json();

    await Promise.all(
      prevShifts.map((shift) => {
        const newDate = formatDate(addDays(new Date(`${shift.date}T00:00:00`), 7));
        return fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...shift, id: undefined, date: newDate }),
        });
      })
    );

    setActionMessage("Copied previous week");
    load(weekStart);
  }

  function exportSchedule() {
    window.print();
    setActionMessage("Print dialog opened");
  }

  async function copyEmployeeAlert() {
    const lines = visibleEmployees.map((employee) => {
      const stats = employeeWeeklyStats(employee, days, shiftMap);
      if (stats.scheduledCount === 0) return `${employee.first_name} ${employee.last_name}: no scheduled shifts`;
      if (stats.dayOffCount > 0) return `${employee.first_name} ${employee.last_name}: ${stats.dayOffCount} day-off entries`;
      return `${employee.first_name} ${employee.last_name}: ${stats.workedHours.toFixed(1)} scheduled hours`;
    });

    await navigator.clipboard.writeText(lines.join("\n"));
    setActionMessage("Employee alert copied to clipboard");
  }

  const totalShifts = Object.values(shiftMap).filter(
    (shift) => days.some((day) => formatDate(day) === shift.date) && !shift.is_day_off
  ).length;

  const totalHours = Object.values(shiftMap)
    .filter((shift) => days.some((day) => formatDate(day) === shift.date) && !shift.is_day_off)
    .reduce((sum, shift) => sum + shiftDurationHours(shift.start_time, shift.end_time), 0);

  const daySummaries = useMemo(
    () =>
      days.map((day) => {
        const date = formatDate(day);
        const shifts = visibleEmployees
          .map((employee) => shiftMap[shiftKey(employee.id, date)])
          .filter((shift): shift is Shift => Boolean(shift));

        const scheduled = shifts.filter((shift) => !shift.is_day_off);
        return {
          date,
          scheduledCount: scheduled.length,
          totalHours: scheduled.reduce(
            (sum, shift) => sum + shiftDurationHours(shift.start_time, shift.end_time),
            0
          ),
        };
      }),
    [days, shiftMap, visibleEmployees]
  );

  const weekNotes = useMemo(() => notes.slice(0, 4), [notes]);
  const footerTotals = useMemo(
    () =>
      visibleEmployees.reduce(
        (totals, employee) => {
          const stats = employeeWeeklyStats(employee, days, shiftMap);
          totals.regular += stats.regularHours;
          totals.overtime += stats.overtimeHours;
          totals.shifts += stats.scheduledCount;
          totals.daysOff += stats.dayOffCount;
          return totals;
        },
        { regular: 0, overtime: 0, shifts: 0, daysOff: 0 }
      ),
    [days, shiftMap, visibleEmployees]
  );

  return (
    <div className="page max-w-none space-y-5">
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-6 py-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Scheduler</div>
            <h1 className="page-title mt-1">Weekly crew scheduling</h1>
            <p className="page-sub">
              {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
              {!loading && <span className="ml-2 text-gray-400">· {totalShifts} shifts · {totalHours.toFixed(2)} hrs</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={openQuickAddShift} className="btn-primary">Add Shift</button>
            <button onClick={openNoteModal} className="btn-secondary">Add Note</button>
            <button onClick={copyPrevWeek} className="btn-secondary">Copy</button>
            <button onClick={() => { setSearch(""); setFilterMode("all"); }} className="btn-secondary">All Schedules</button>
            <button onClick={exportSchedule} className="btn-secondary">Export PDF</button>
            <button onClick={copyEmployeeAlert} className="btn-secondary">Employee Alert</button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekStart((value) => subWeeks(value, 1))} className="btn-nav">←</button>
            <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))} className="btn-nav">Today</button>
            <button onClick={() => setWeekStart((value) => addWeeks(value, 1))} className="btn-nav">→</button>
            <div className="ml-2 text-sm font-semibold text-gray-600">
              This week: {format(weekStart, "d MMM")} - {format(addDays(weekStart, 6), "d MMM yyyy")}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={filterMode}
              onChange={(event) => setFilterMode(event.target.value as FilterMode)}
              className="input w-44"
            >
              <option value="all">All employees</option>
              <option value="scheduled">Scheduled only</option>
              <option value="unscheduled">No schedule</option>
              <option value="dayoff">Has day off</option>
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employees..."
              className="input w-full sm:w-64"
            />
          </div>
        </div>

        {actionMessage && (
          <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-3 text-sm font-medium text-emerald-700">
            {actionMessage}
          </div>
        )}

        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {weekNotes.length > 0 && (
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Week Notes</div>
            <div className="grid gap-3 xl:grid-cols-4">
              {weekNotes.map((note) => (
                <div key={note.id} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                    {note.type ?? "note"} · {note.date}
                  </div>
                  <div className="mt-2 text-sm text-amber-900">{note.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="th sticky left-0 z-10 w-56 bg-gray-50">Employee</th>
                {days.map((day) => (
                  <th key={day.toISOString()} className={`th min-w-[132px] text-center ${isToday(day) ? "text-brand-600" : ""}`}>
                    <div>{format(day, "EEEE")}</div>
                    <div className={`mt-0.5 text-xs font-normal ${isToday(day) ? "font-semibold text-brand-500" : "text-gray-400"}`}>
                      {format(day, "MM/dd")}
                    </div>
                  </th>
                ))}
                <th className="th text-center">Reg Hrs</th>
                <th className="th text-center">OT</th>
                <th className="th text-center">Shifts</th>
                <th className="th text-center">Days Off</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <SkeletonGrid days={days} />
              ) : (
                visibleEmployees.map((employee) => {
                  const stats = employeeWeeklyStats(employee, days, shiftMap);
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50/40">
                      <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-4 py-3 align-top">
                        <div className="font-semibold text-gray-900">{employee.first_name} {employee.last_name}</div>
                        <div className="mt-1 text-xs text-gray-400">Weekly Schedule</div>
                        {employee.worker_type && <div className="mt-1 text-xs text-brand-500">{employee.worker_type}</div>}
                      </td>
                      {days.map((day) => {
                        const date = formatDate(day);
                        const shift = shiftMap[shiftKey(employee.id, date)];
                        const hours = shiftDurationHours(shift?.start_time, shift?.end_time);
                        return (
                          <td key={date} className="px-1.5 py-1.5">
                            <button
                              onClick={() => openCell(employee, day)}
                              className={`w-full rounded-xl border px-2 py-3 text-left text-xs transition-all ${
                                shift?.is_day_off
                                  ? "border-amber-100 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : shift
                                  ? "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "border-dashed border-gray-200 text-gray-300 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {!shift && <div className="text-center text-gray-300">No event</div>}
                              {shift?.is_day_off && (
                                <>
                                  <div className="font-semibold uppercase tracking-wide">Day Off</div>
                                  <div className="mt-1 text-[11px] text-amber-500">Click to edit</div>
                                </>
                              )}
                              {shift && !shift.is_day_off && (
                                <>
                                  <div className="font-semibold">{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</div>
                                  <div className="mt-1 text-[11px] text-emerald-500">{hours.toFixed(2)} hours</div>
                                </>
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center font-semibold text-gray-700">{stats.regularHours.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center text-gray-500">{stats.overtimeHours.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center text-gray-700">{stats.scheduledCount}</td>
                      <td className="px-3 py-3 text-center text-gray-500">{stats.dayOffCount}</td>
                    </tr>
                  );
                })
              )}

              {!loading && visibleEmployees.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-14 text-center text-sm text-gray-400">
                    No employees matched this schedule view.
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td className="sticky left-0 bg-gray-50 px-4 py-4">
                  <div className="font-semibold text-gray-700">Day Summary</div>
                  <div className="text-xs text-gray-400">Visible employees only</div>
                </td>
                {daySummaries.map((summary) => (
                  <td key={summary.date} className="px-3 py-4 text-center">
                    <div className="font-semibold text-gray-700">{summary.scheduledCount}</div>
                    <div className="text-xs text-gray-400">{summary.totalHours.toFixed(2)} hrs</div>
                  </td>
                ))}
                <td className="px-3 py-4 text-center font-semibold text-gray-700">{footerTotals.regular.toFixed(2)}</td>
                <td className="px-3 py-4 text-center text-gray-500">{footerTotals.overtime.toFixed(2)}</td>
                <td className="px-3 py-4 text-center text-gray-700">{footerTotals.shifts}</td>
                <td className="px-3 py-4 text-center text-gray-500">{footerTotals.daysOff}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Shift - ${editShift.employee_name}`}>
        <div className="space-y-4">
          {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>}
          <div>
            <label className="label">Date</label>
            <input className="input bg-gray-50 text-gray-500" readOnly value={editShift.date ?? ""} />
          </div>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-brand-600"
              checked={editShift.is_day_off ?? false}
              onChange={(e) => setEditShift((prev) => ({ ...prev, is_day_off: e.target.checked }))}
            />
            Mark as Day Off
          </label>
          {!editShift.is_day_off && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start Time</label>
                <input
                  className="input"
                  type="time"
                  value={editShift.start_time ?? "07:00"}
                  onChange={(e) => setEditShift((prev) => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">End Time</label>
                <input
                  className="input"
                  type="time"
                  value={editShift.end_time ?? "15:30"}
                  onChange={(e) => setEditShift((prev) => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>
          )}
          {!editShift.is_day_off && editShift.start_time && editShift.end_time && (
            <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
              Duration: {shiftDurationHours(editShift.start_time, editShift.end_time).toFixed(2)} hours
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveShift} disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save Shift"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={noteModalOpen} onClose={() => setNoteModalOpen(false)} title="Add Scheduler Note">
        <div className="space-y-4">
          {noteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{noteError}</p>}
          <div>
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              value={noteDraft.date}
              onChange={(event) => setNoteDraft((prev) => ({ ...prev, date: event.target.value }))}
            />
          </div>
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={noteDraft.type}
              onChange={(event) => setNoteDraft((prev) => ({ ...prev, type: event.target.value }))}
            >
              <option value="daily">Daily</option>
              <option value="general">General</option>
              <option value="safety">Safety</option>
            </select>
          </div>
          <div>
            <label className="label">Note</label>
            <textarea
              className="input min-h-32"
              value={noteDraft.content}
              onChange={(event) => setNoteDraft((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Crew reminder, routing note, callout, or safety message..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setNoteModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveNote} disabled={noteSaving} className="btn-primary">
              {noteSaving ? "Saving..." : "Save Note"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
