"use client";
import { useEffect, useState, useCallback } from "react";
import { addWeeks, subWeeks, startOfWeek, addDays, format, isToday } from "date-fns";
import { Employee, Shift, Note, ScheduleTemplate } from "@/lib/types";
import { getWeekDays, formatDate, formatTime, shiftDurationHours } from "@/lib/utils";
import Modal from "@/components/Modal";
import BrandText from "@/components/BrandText";

type ShiftMap = Record<string, Shift>;
function shiftKey(empId: number, date: string) { return `${empId}__${date}`; }

function SkeletonGrid({ days }: { days: Date[] }) {
  return <>{Array.from({ length: 6 }).map((_, i) => <tr key={i} className="animate-pulse border-b border-gray-100"><td className="sticky left-0 border-r border-gray-100 bg-white px-4 py-3"><div className="mb-1 h-3.5 w-28 rounded-full bg-gray-100" /><div className="h-2.5 w-16 rounded-full bg-gray-100" /></td>{days.map((_, j) => <td key={j} className="px-2 py-2"><div className="h-12 w-full rounded-lg bg-gray-100" /></td>)}<td className="px-2 py-2"><div className="h-12 w-full rounded-lg bg-gray-100" /></td><td className="px-2 py-2"><div className="h-12 w-full rounded-lg bg-gray-100" /></td><td className="px-2 py-2"><div className="h-12 w-full rounded-lg bg-gray-100" /></td><td className="px-2 py-2"><div className="h-12 w-full rounded-lg bg-gray-100" /></td></tr>)}</>;
}

export default function SchedulerPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const days = getWeekDays(weekStart);
  const start = formatDate(days[0]);
  const end = formatDate(days[6]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftMap, setShiftMap] = useState<ShiftMap>({});
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editShift, setEditShift] = useState<Partial<Shift> & { employee_name?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [weekNoteId, setWeekNoteId] = useState<number | null>(null);
  const [weekNoteText, setWeekNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);

  const load = useCallback(async (ws: Date) => {
    setLoading(true);
    setError("");
    const rangeStart = formatDate(getWeekDays(ws)[0]);
    const rangeEnd = formatDate(getWeekDays(ws)[6]);
    try {
      const [empRes, shiftRes, noteRes, templateRes] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/shifts?start=${rangeStart}&end=${rangeEnd}`),
        fetch(`/api/notes?start=${rangeStart}&end=${rangeEnd}`),
        fetch("/api/schedule-templates"),
      ]);
      if (!empRes.ok || !shiftRes.ok || !noteRes.ok || !templateRes.ok) throw new Error("Failed to load scheduler data");
      const [emps, shifts, notes, templateRows]: [Employee[], Shift[], Note[], ScheduleTemplate[]] = await Promise.all([empRes.json(), shiftRes.json(), noteRes.json(), templateRes.json()]);
      const map: ShiftMap = {};
      for (const shift of shifts) map[shiftKey(shift.employee_id, shift.date)] = shift;
      const weekNote = notes.find((note) => note.type === "scheduler-week" && note.date === rangeStart);
      setEmployees(emps.filter((employee) => employee.active));
      setShiftMap(map);
      setTemplates(templateRows);
      setWeekNoteId(weekNote?.id ?? null);
      setWeekNoteText(weekNote?.content ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(weekStart); }, [weekStart, load]);

  function openCell(emp: Employee, day: Date) {
    const date = formatDate(day);
    const existing = shiftMap[shiftKey(emp.id, date)];
    setEditShift({ ...(existing ?? {}), employee_id: emp.id, date, employee_name: `${emp.first_name} ${emp.last_name}`, start_time: existing?.start_time ?? "07:00", end_time: existing?.end_time ?? "15:30", is_day_off: existing?.is_day_off ?? false });
    setSaveError("");
    setModalOpen(true);
  }
  async function saveShift() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editShift) });
      if (!res.ok) { const body = await res.json(); throw new Error(body.error ?? "Save failed"); }
      setModalOpen(false);
      setMessage("Shift saved.");
      load(weekStart);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyPrevWeek() {
    const prevStart = formatDate(subWeeks(weekStart, 1));
    const prevEnd = formatDate(addDays(subWeeks(weekStart, 1), 6));
    const res = await fetch(`/api/shifts?start=${prevStart}&end=${prevEnd}`);
    const prevShifts: Shift[] = await res.json();
    await Promise.all(prevShifts.map((shift) => fetch("/api/shifts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...shift, id: undefined, date: formatDate(addDays(new Date(shift.date + "T00:00:00"), 7)) }) })));
    setMessage("Previous week copied into this week.");
    load(weekStart);
  }

  async function saveWeekNote() {
    setNoteSaving(true);
    setError("");
    try {
      const res = await fetch(weekNoteId ? `/api/notes/${weekNoteId}` : "/api/notes", {
        method: weekNoteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: start, type: "scheduler-week", content: weekNoteText }),
      });
      if (!res.ok) { const body = await res.json(); throw new Error(body.error ?? "Failed to save week note"); }
      setMessage("Weekly planning note saved.");
      load(weekStart);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save week note");
    } finally {
      setNoteSaving(false);
    }
  }

  async function saveTemplate() {
    if (!templateName.trim()) {
      setError("Enter a template name first.");
      return;
    }
    setTemplateSaving(true);
    setError("");
    try {
      const weekData = Object.values(shiftMap)
        .filter((shift) => days.some((day) => formatDate(day) === shift.date))
        .map((shift) => ({ employee_id: shift.employee_id, weekday: new Date(shift.date + "T00:00:00").getDay(), start_time: shift.start_time ?? null, end_time: shift.end_time ?? null, is_day_off: shift.is_day_off }));
      const res = await fetch("/api/schedule-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: templateName, week_data: weekData }) });
      if (!res.ok) { const body = await res.json(); throw new Error(body.error ?? "Failed to save template"); }
      const template: ScheduleTemplate = await res.json();
      setMessage(`Template saved: ${template.name}`);
      setSelectedTemplateId(String(template.id));
      setTemplateName(template.name);
      load(weekStart);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template");
    } finally {
      setTemplateSaving(false);
    }
  }

  async function applyTemplate() {
    const template = templates.find((item) => String(item.id) === selectedTemplateId);
    if (!template) {
      setError("Choose a template first.");
      return;
    }
    setTemplateSaving(true);
    setError("");
    try {
      await Promise.all(template.week_data.map((entry) => {
        const targetDate = days.find((day) => day.getDay() === entry.weekday);
        if (!targetDate) return Promise.resolve();
        return fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ employee_id: entry.employee_id, date: formatDate(targetDate), start_time: entry.start_time, end_time: entry.end_time, is_day_off: entry.is_day_off }),
        });
      }));
      setMessage(`Template applied: ${template.name}`);
      load(weekStart);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply template");
    } finally {
      setTemplateSaving(false);
    }
  }

  const totalShifts = Object.values(shiftMap).filter((shift) => days.some((day) => formatDate(day) === shift.date) && !shift.is_day_off).length;
  const dayOffCount = Object.values(shiftMap).filter((shift) => days.some((day) => formatDate(day) === shift.date) && shift.is_day_off).length;

  return (
    <div className="p-6">
      <section className="mb-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_#07111f_0%,_rgb(var(--brand-700))_34%,_rgb(var(--brand-600))_66%,_rgb(var(--accent-500))_100%)] px-6 py-6 text-white shadow-[0_30px_80px_-50px_rgba(15,23,42,0.82)]">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60"><BrandText field="companyName" /> Scheduler</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Plan labor with enough context to dispatch cleanly.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80"><BrandText field="schedulerFocus" /></p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/75">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2"><BrandText field="clientLabel" /></span>
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">{format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">Planned shifts</p>
              <p className="mt-2 text-2xl font-semibold">{totalShifts}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">Days off</p>
              <p className="mt-2 text-2xl font-semibold">{dayOffCount}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="page-header">
        <div>
          <h1 className="page-title">Scheduler</h1>
          <p className="page-sub">{format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}{!loading && <span className="ml-2 text-gray-400">- {totalShifts} shifts</span>}</p>
        </div>
        <div className="flex items-center gap-2"><button onClick={copyPrevWeek} className="btn-ghost text-xs">Copy prev. week</button><div className="h-4 w-px bg-gray-200" /><button onClick={() => setWeekStart((value) => subWeeks(value, 1))} className="btn-nav">Prev</button><button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} className="btn-nav">Today</button><button onClick={() => setWeekStart((value) => addWeeks(value, 1))} className="btn-nav">Next</button></div>
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.1fr_repeat(3,minmax(0,1fr))]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">How To Use This Page</p><h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Build the week before you assign work.</h2><p className="mt-2 text-sm leading-6 text-slate-600">Click any day cell to set a shift or mark a day off. Save a weekly note for crew instructions, then save the week as a template when you find a pattern worth reusing.</p></div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Active Crew</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{employees.length}</p><p className="mt-1 text-sm text-slate-500">Employees available for scheduling</p></div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Shifts Planned</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{totalShifts}</p><p className="mt-1 text-sm text-slate-500">Scheduled shifts in this week</p></div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Days Off</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{dayOffCount}</p><p className="mt-1 text-sm text-slate-500">Planned day-off entries this week</p></div>
      </div>
      <div className="mb-5 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">Weekly Planning Note</p><p className="mt-1 text-sm text-slate-600">This note follows the week and can capture crew-wide instructions before workboard assignment begins.</p></div><button onClick={saveWeekNote} disabled={noteSaving} className="btn-primary text-xs">{noteSaving ? "Saving..." : "Save Note"}</button></div>
          <textarea className="input mt-4 min-h-36 resize-y" value={weekNoteText} onChange={(event) => setWeekNoteText(event.target.value)} placeholder="Example: Start on the back nine Monday, prep tournament setup Wednesday, keep irrigation late Friday." />
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700">Week Templates</p>
          <p className="mt-1 text-sm text-slate-600">Save repeatable labor patterns, then apply them to future weeks before adjusting exceptions.</p>
          <div className="mt-4 space-y-3">
            <select className="input" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}><option value="">Choose template...</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
            <div className="flex gap-2"><button onClick={applyTemplate} disabled={templateSaving || !selectedTemplateId} className="btn-secondary flex-1 text-sm">Apply template</button><button onClick={copyPrevWeek} className="btn-secondary flex-1 text-sm">Copy last week</button></div>
            <input className="input" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" />
            <button onClick={saveTemplate} disabled={templateSaving} className="btn-primary w-full text-sm">{templateSaving ? "Saving..." : "Save current week as template"}</button>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-[880px] w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="th sticky left-0 w-44 bg-gray-50">Employee</th>
              {days.map((day) => <th key={day.toISOString()} className={`th min-w-[110px] text-center ${isToday(day) ? "text-brand-600" : ""}`}><div>{format(day, "EEE")}</div><div className={`mt-0.5 text-xs font-normal ${isToday(day) ? "font-semibold text-brand-500" : "text-gray-400"}`}>{format(day, "MM/dd")}</div></th>)}
              <th className="th min-w-[95px] text-center">Hours</th>
              <th className="th min-w-[95px] text-center">Shifts</th>
              <th className="th min-w-[95px] text-center">Days Off</th>
              <th className="th min-w-[120px] text-center">Exceptions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <SkeletonGrid days={days} /> : employees.map((emp) => {
              const weekShifts = days.map((day) => shiftMap[shiftKey(emp.id, formatDate(day))]).filter(Boolean) as Shift[];
              const weeklyHours = weekShifts.filter((shift) => !shift.is_day_off).reduce((sum, shift) => sum + shiftDurationHours(shift.start_time, shift.end_time), 0);
              const weeklyShiftCount = weekShifts.filter((shift) => !shift.is_day_off).length;
              const weeklyDayOffCount = weekShifts.filter((shift) => shift.is_day_off).length;
              const hasLongShift = weekShifts.some((shift) => !shift.is_day_off && shiftDurationHours(shift.start_time, shift.end_time) > 10);
              const hasLowCoverage = weeklyShiftCount < 3;
              return <tr key={emp.id} className="transition-colors hover:bg-gray-50/50"><td className="sticky left-0 border-r border-gray-100 bg-white px-4 py-3"><div className="text-sm font-medium leading-tight text-gray-900">{emp.first_name} {emp.last_name}</div>{emp.worker_type && <div className="mt-0.5 text-xs text-gray-400">{emp.worker_type}</div>}</td>{days.map((day) => {
                const date = formatDate(day);
                const shift = shiftMap[shiftKey(emp.id, date)];
                const hours = shiftDurationHours(shift?.start_time, shift?.end_time);
                return <td key={date} className="px-1.5 py-1.5"><button onClick={() => openCell(emp, day)} className={`w-full rounded-lg border px-2 py-2 text-center text-xs transition-all ${shift?.is_day_off ? "border-gray-200 bg-gray-100 text-gray-400" : shift ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100" : "border-dashed border-gray-200 text-gray-300 hover:border-gray-300 hover:bg-gray-50"}`}>{shift?.is_day_off ? <span>Day Off</span> : shift ? <><div className="font-semibold">{formatTime(shift.start_time)}-{formatTime(shift.end_time)}</div><div className="mt-0.5 text-brand-400">{hours.toFixed(1)}h</div></> : <span className="text-gray-300">+ Add</span>}</button></td>;
              })}<td className="td text-center font-semibold text-slate-900">{weeklyHours.toFixed(1)}</td><td className="td text-center text-slate-700">{weeklyShiftCount}</td><td className="td text-center text-slate-700">{weeklyDayOffCount}</td><td className="td"><div className="flex flex-wrap justify-center gap-1.5">{hasLongShift && <span className="badge bg-amber-100 text-amber-700">Long shift</span>}{hasLowCoverage && <span className="badge bg-sky-100 text-sky-700">Low coverage</span>}{!hasLongShift && !hasLowCoverage && <span className="badge bg-emerald-100 text-emerald-700">Clear</span>}</div></td></tr>;
            })}
            {!loading && employees.length === 0 && <tr><td colSpan={12} className="py-14 text-center text-sm text-gray-400">No active employees. Add employees first.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Shift - ${editShift.employee_name}`}>
        <div className="space-y-4">
          {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>}
          <div><label className="label">Date</label><input className="input bg-gray-50 text-gray-500" readOnly value={editShift.date ?? ""} /></div>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-gray-700"><input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={editShift.is_day_off ?? false} onChange={(event) => setEditShift((prev) => ({ ...prev, is_day_off: event.target.checked }))} />Mark as Day Off</label>
          {!editShift.is_day_off && <div className="grid grid-cols-2 gap-3"><div><label className="label">Start Time</label><input className="input" type="time" value={editShift.start_time ?? "07:00"} onChange={(event) => setEditShift((prev) => ({ ...prev, start_time: event.target.value }))} /></div><div><label className="label">End Time</label><input className="input" type="time" value={editShift.end_time ?? "15:30"} onChange={(event) => setEditShift((prev) => ({ ...prev, end_time: event.target.value }))} /></div></div>}
          {!editShift.is_day_off && editShift.start_time && editShift.end_time && <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">Duration: {shiftDurationHours(editShift.start_time, editShift.end_time).toFixed(2)} hours</div>}
          <div className="flex justify-end gap-2 pt-2"><button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button onClick={saveShift} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Shift"}</button></div>
        </div>
      </Modal>
    </div>
  );
}
