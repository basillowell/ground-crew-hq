"use client";
import { useEffect, useState, useCallback } from "react";
import { addDays, subDays, format } from "date-fns";
import { Employee, Shift, TaskAssignment, Task, EquipmentUnit } from "@/lib/types";
import { formatDate, shiftDurationHours } from "@/lib/utils";
import Modal from "@/components/Modal";

function HoursBar({ allocated, total }: { allocated: number; total: number }) {
  if (total <= 0) return null;
  const pct    = Math.min((allocated / total) * 100, 100);
  const isOver = allocated > total + 0.01;
  const isDone = Math.abs(allocated - total) <= 0.01;
  return (
    <div className="mt-1.5">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
        <div
          className={`h-full rounded-full transition-all ${isOver ? "bg-red-400" : isDone ? "bg-emerald-400" : "bg-brand-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <div className="h-3.5 w-36 bg-gray-100 rounded-full mb-2" />
          <div className="h-2.5 w-48 bg-gray-100 rounded-full" />
        </div>
        <div className="h-6 w-16 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

export default function WorkboardPage() {
  const [date, setDate]           = useState(() => formatDate(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftMap, setShiftMap]   = useState<Record<number, Shift>>({});
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [equipment, setEquipment] = useState<EquipmentUnit[]>([]);
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [newTask, setNewTask]     = useState({ shift_id: 0, task_id: 0, duration: 1, equipment_unit_id: "" });
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async (d: string) => {
    setLoading(true); setError("");
    try {
      const [empRes, shiftRes, taskRes, eqRes, asgRes] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/shifts?start=${d}&end=${d}`),
        fetch("/api/tasks"),
        fetch("/api/equipment"),
        fetch(`/api/task-assignments?date=${d}`),
      ]);
      const [emps, shifts, tks, eq, asg]: [Employee[], Shift[], Task[], EquipmentUnit[], TaskAssignment[]] =
        await Promise.all([empRes.json(), shiftRes.json(), taskRes.json(), eqRes.json(), asgRes.json()]);

      const map: Record<number, Shift> = {};
      for (const s of shifts) map[s.employee_id] = s;

      setEmployees(emps.filter(e => e.active));
      setShiftMap(map);
      setTasks(tks);
      setEquipment(eq);
      setAssignments(asg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  function empAssignments(shiftId: number) {
    return assignments.filter(a => a.shift_id === shiftId).sort((a, b) => a.position - b.position);
  }

  function totalAllocated(shiftId: number) {
    return empAssignments(shiftId).reduce((s, a) => s + Number(a.duration), 0);
  }

  function toggleExpand(empId: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(empId) ? next.delete(empId) : next.add(empId);
      return next;
    });
  }

  function openAddTask(shiftId: number) {
    setNewTask({ shift_id: shiftId, task_id: tasks[0]?.id ?? 0, duration: 1, equipment_unit_id: "" });
    setSaveError(""); setModalOpen(true);
  }

  async function saveTask() {
    if (!newTask.task_id) { setSaveError("Please select a task."); return; }
    if (newTask.duration <= 0) { setSaveError("Duration must be greater than 0."); return; }
    setSaving(true); setSaveError("");
    try {
      const body = {
        shift_id:          newTask.shift_id,
        task_id:           newTask.task_id,
        duration:          newTask.duration,
        position:          empAssignments(newTask.shift_id).length,
        equipment_unit_id: newTask.equipment_unit_id ? parseInt(newTask.equipment_unit_id) : null,
      };
      const res = await fetch("/api/task-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? "Save failed"); }
      setModalOpen(false); load(date);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(id: number) {
    await fetch(`/api/task-assignments/${id}`, { method: "DELETE" });
    setAssignments(prev => prev.filter(a => a.id !== id));
  }

  const scheduledCount = employees.filter(e => shiftMap[e.id] && !shiftMap[e.id].is_day_off).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workboard</h1>
          <p className="page-sub">{format(new Date(date + "T00:00:00"), "EEEE, MMMM d")}
            {!loading && <span className="ml-2 text-gray-400">· {scheduledCount} scheduled</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(formatDate(subDays(new Date(date + "T00:00:00"), 1)))} className="btn-nav">← Prev</button>
          <button onClick={() => setDate(formatDate(new Date()))} className="btn-nav">Today</button>
          <button onClick={() => setDate(formatDate(addDays(new Date(date + "T00:00:00"), 1)))} className="btn-nav">Next →</button>
          <input
            type="date" value={date}
            onChange={e => setDate(e.target.value)}
            className="input w-40 text-sm"
          />
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

      <div className="space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : employees.map(emp => {
              const shift      = shiftMap[emp.id];
              const isExpanded = expanded.has(emp.id);
              const asgList    = shift ? empAssignments(shift.id) : [];
              const shiftHrs   = shift ? shiftDurationHours(shift.start_time, shift.end_time) : 0;
              const allocated  = shift ? totalAllocated(shift.id) : 0;
              const remaining  = shiftHrs - allocated;
              const isOver     = remaining < -0.01;
              const isDone     = Math.abs(remaining) < 0.01 && shiftHrs > 0;

              return (
                <div key={emp.id} className="card">
                  {/* Header row */}
                  <div
                    className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                    onClick={() => toggleExpand(emp.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{emp.first_name} {emp.last_name}</span>
                        {emp.worker_type && <span className="text-xs text-gray-400">{emp.worker_type}</span>}
                      </div>
                      {shift && !shift.is_day_off && (
                        <>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                            <span>{shiftHrs.toFixed(1)}h shift</span>
                            <span className={isOver ? "text-red-500 font-medium" : isDone ? "text-emerald-600 font-medium" : "text-amber-600"}>
                              {isOver ? `${Math.abs(remaining).toFixed(1)}h over` : isDone ? "✓ Fully allocated" : `${remaining.toFixed(1)}h remaining`}
                            </span>
                          </div>
                          <HoursBar allocated={allocated} total={shiftHrs} />
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      {!shift      && <span className="badge bg-gray-100 text-gray-400">No shift</span>}
                      {shift?.is_day_off && <span className="badge bg-gray-100 text-gray-400">Day off</span>}
                      {isDone      && <span className="badge bg-emerald-100 text-emerald-700">Complete</span>}
                      {isOver      && <span className="badge bg-red-100 text-red-600">Over</span>}
                      <svg viewBox="0 0 20 20" fill="currentColor"
                        className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  </div>

                  {/* Task list */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-3 pt-2 space-y-1.5">
                      {shift && !shift.is_day_off ? (
                        <>
                          {asgList.length === 0 && (
                            <p className="text-xs text-gray-400 italic py-1">No tasks assigned yet.</p>
                          )}
                          {asgList.map((a, i) => (
                            <div key={a.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group">
                              <span className="text-gray-300 text-xs w-4 shrink-0">{i + 1}</span>
                              <span className="flex-1 text-sm font-medium text-gray-800 min-w-0 truncate">{a.task_name}</span>
                              <span className="font-mono text-xs text-brand-600 shrink-0">{Number(a.duration).toFixed(1)}h</span>
                              {a.equipment_unit_name && (
                                <span className="badge bg-sky-100 text-sky-700 shrink-0">{a.equipment_unit_name}</span>
                              )}
                              <button
                                onClick={() => deleteAssignment(a.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all text-sm leading-none ml-1"
                              >✕</button>
                            </div>
                          ))}
                          <button
                            onClick={() => openAddTask(shift.id)}
                            className="w-full text-xs text-brand-600 hover:text-brand-800 border border-dashed border-brand-200 rounded-lg py-2 hover:bg-brand-50 transition-colors mt-1"
                          >
                            + Add Task
                          </button>
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 py-2 italic">
                          {shift?.is_day_off ? "Employee has the day off." : "No shift scheduled. Set a shift in the Scheduler first."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
        }
        {!loading && employees.length === 0 && (
          <div className="card text-center py-14 text-gray-400 text-sm">No active employees found.</div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Task">
        <div className="space-y-4">
          {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
          <div>
            <label className="label">Task</label>
            <select className="input" value={newTask.task_id}
              onChange={e => setNewTask(p => ({ ...p, task_id: parseInt(e.target.value) }))}>
              <option value={0} disabled>Select a task…</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.group_name ? `${t.group_name} › ` : ""}{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Duration (hours)</label>
            <input className="input" type="number" step="0.25" min="0.25" max="24"
              value={newTask.duration}
              onChange={e => setNewTask(p => ({ ...p, duration: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className="label">Equipment Unit <span className="normal-case font-normal text-gray-400">(optional)</span></label>
            <select className="input" value={newTask.equipment_unit_id}
              onChange={e => setNewTask(p => ({ ...p, equipment_unit_id: e.target.value }))}>
              <option value="">None</option>
              {equipment.filter(eq => eq.status === "ready").map(eq => (
                <option key={eq.id} value={eq.id}>{eq.type_name} — {eq.unit_name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveTask} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Add Task"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
