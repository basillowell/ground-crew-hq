"use client";
import { useEffect, useState, useCallback } from "react";
import { addWeeks, subWeeks, startOfWeek, addDays, format, isToday } from "date-fns";
import { Employee, Shift } from "@/lib/types";
import { getWeekDays, formatDate, formatTime, shiftDurationHours } from "@/lib/utils";
import Modal from "@/components/Modal";

type ShiftMap = Record<string, Shift>; // key: `${empId}__${date}`

function shiftKey(empId: number, date: string) { return `${empId}__${date}`; }

function SkeletonGrid({ days }: { days: Date[] }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-gray-100">
          <td className="px-4 py-3 sticky left-0 bg-white border-r border-gray-100">
            <div className="h-3.5 w-28 bg-gray-100 rounded-full mb-1" />
            <div className="h-2.5 w-16 bg-gray-100 rounded-full" />
          </td>
          {days.map((_, j) => (
            <td key={j} className="px-2 py-2">
              <div className="h-12 bg-gray-100 rounded-lg w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function SchedulerPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const days = getWeekDays(weekStart);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftMap, setShiftMap]   = useState<ShiftMap>({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editShift, setEditShift] = useState<Partial<Shift> & { employee_name?: string }>({});
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async (ws: Date) => {
    setLoading(true); setError("");
    const start = formatDate(getWeekDays(ws)[0]);
    const end   = formatDate(getWeekDays(ws)[6]);
    try {
      const [empRes, shiftRes] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/shifts?start=${start}&end=${end}`),
      ]);
      if (!empRes.ok || !shiftRes.ok) throw new Error("Failed to load data");
      const emps: Employee[]  = await empRes.json();
      const shifts: Shift[]   = await shiftRes.json();
      const map: ShiftMap = {};
      for (const s of shifts) map[shiftKey(s.employee_id, s.date)] = s;
      setEmployees(emps.filter(e => e.active));
      setShiftMap(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(weekStart); }, [weekStart, load]);

  function openCell(emp: Employee, day: Date) {
    const date  = formatDate(day);
    const existing = shiftMap[shiftKey(emp.id, date)];
    setEditShift({
      ...(existing ?? {}),
      employee_id: emp.id,
      date,
      employee_name: `${emp.first_name} ${emp.last_name}`,
      start_time:  existing?.start_time  ?? "07:00",
      end_time:    existing?.end_time    ?? "15:30",
      is_day_off:  existing?.is_day_off  ?? false,
    });
    setSaveError(""); setModalOpen(true);
  }

  async function saveShift() {
    setSaving(true); setSaveError("");
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editShift),
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? "Save failed"); }
      setModalOpen(false); load(weekStart);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrevWeek() {
    const prevStart = formatDate(subWeeks(weekStart, 1));
    const prevEnd   = formatDate(addDays(subWeeks(weekStart, 1), 6));
    const res = await fetch(`/api/shifts?start=${prevStart}&end=${prevEnd}`);
    const prevShifts: Shift[] = await res.json();
    await Promise.all(prevShifts.map(s => {
      const newDate = formatDate(addDays(new Date(s.date + "T00:00:00"), 7));
      return fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...s, id: undefined, date: newDate }),
      });
    }));
    load(weekStart);
  }

  const totalShifts = Object.values(shiftMap).filter(s =>
    days.some(d => formatDate(d) === s.date) && !s.is_day_off
  ).length;

  return (
    <div className="p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Scheduler</h1>
          <p className="page-sub">
            {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}
            {!loading && <span className="ml-2 text-gray-400">· {totalShifts} shifts</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyPrevWeek} className="btn-ghost text-xs">Copy prev. week</button>
          <div className="h-4 w-px bg-gray-200" />
          <button onClick={() => setWeekStart(w => subWeeks(w, 1))} className="btn-nav">← Prev</button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="btn-nav">Today</button>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))} className="btn-nav">Next →</button>
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="th sticky left-0 bg-gray-50 w-44">Employee</th>
              {days.map(d => (
                <th key={d.toISOString()} className={`th text-center min-w-[110px] ${isToday(d) ? "text-brand-600" : ""}`}>
                  <div>{format(d, "EEE")}</div>
                  <div className={`text-xs font-normal mt-0.5 ${isToday(d) ? "text-brand-500 font-semibold" : "text-gray-400"}`}>
                    {format(d, "MM/dd")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading
              ? <SkeletonGrid days={days} />
              : employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-white border-r border-gray-100">
                    <div className="font-medium text-gray-900 text-sm leading-tight">{emp.first_name} {emp.last_name}</div>
                    {emp.worker_type && <div className="text-xs text-gray-400 mt-0.5">{emp.worker_type}</div>}
                  </td>
                  {days.map(day => {
                    const date  = formatDate(day);
                    const shift = shiftMap[shiftKey(emp.id, date)];
                    const hrs   = shiftDurationHours(shift?.start_time, shift?.end_time);
                    return (
                      <td key={date} className="px-1.5 py-1.5">
                        <button
                          onClick={() => openCell(emp, day)}
                          className={`w-full rounded-lg px-2 py-2 text-xs transition-all border text-center ${
                            shift?.is_day_off
                              ? "bg-gray-100 border-gray-200 text-gray-400"
                              : shift
                              ? "bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100"
                              : "border-dashed border-gray-200 text-gray-300 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {shift?.is_day_off ? (
                            <span>Day Off</span>
                          ) : shift ? (
                            <>
                              <div className="font-semibold">{formatTime(shift.start_time)}–{formatTime(shift.end_time)}</div>
                              <div className="text-brand-400 mt-0.5">{hrs.toFixed(1)}h</div>
                            </>
                          ) : (
                            <span className="text-gray-300">+ Add</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))
            }
            {!loading && employees.length === 0 && (
              <tr><td colSpan={8} className="text-center py-14 text-gray-400 text-sm">No active employees. Add employees first.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Shift — ${editShift.employee_name}`}>
        <div className="space-y-4">
          {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
          <div>
            <label className="label">Date</label>
            <input className="input bg-gray-50 text-gray-500" readOnly value={editShift.date ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input type="checkbox" className="rounded accent-brand-600 w-4 h-4"
              checked={editShift.is_day_off ?? false}
              onChange={e => setEditShift(p => ({ ...p, is_day_off: e.target.checked }))} />
            Mark as Day Off
          </label>
          {!editShift.is_day_off && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Start Time</label>
                <input className="input" type="time" value={editShift.start_time ?? "07:00"} onChange={e => setEditShift(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div>
                <label className="label">End Time</label>
                <input className="input" type="time" value={editShift.end_time ?? "15:30"} onChange={e => setEditShift(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
          )}
          {!editShift.is_day_off && editShift.start_time && editShift.end_time && (
            <div className="bg-brand-50 rounded-lg px-3 py-2 text-sm text-brand-700 font-medium">
              Duration: {shiftDurationHours(editShift.start_time, editShift.end_time).toFixed(2)} hours
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveShift} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save Shift"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
