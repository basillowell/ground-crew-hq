"use client";
import { useEffect, useState, useCallback } from "react";
import { addDays, subDays, format } from "date-fns";
import { Employee, Shift, TaskAssignment, Task, EquipmentUnit, Note } from "@/lib/types";
import { formatDate, shiftDurationHours } from "@/lib/utils";
import Modal from "@/components/Modal";

function HoursBar({ allocated, total }: { allocated: number; total: number }) {
  if (total <= 0) return null;
  const pct = Math.min((allocated / total) * 100, 100);
  const isOver = allocated > total + 0.01;
  const isDone = Math.abs(allocated - total) <= 0.01;
  return (
    <div className="mt-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
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
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="mb-2 h-3.5 w-36 rounded-full bg-gray-100" />
          <div className="h-2.5 w-48 rounded-full bg-gray-100" />
        </div>
        <div className="h-6 w-16 rounded-full bg-gray-100" />
      </div>
    </div>
  );
}

export default function WorkboardPage() {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftMap, setShiftMap] = useState<Record<number, Shift>>({});
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [equipment, setEquipment] = useState<EquipmentUnit[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ id: 0, shift_id: 0, task_id: 0, duration: 1, equipment_unit_id: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineTask, setInlineTask] = useState({ task_id: 0, duration: 1, equipment_unit_id: "" });
  const [dragAssignmentId, setDragAssignmentId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Partial<Note>>({ date, type: "daily", content: "" });
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    try {
      const [empRes, shiftRes, taskRes, eqRes, asgRes, noteRes] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/shifts?start=${d}&end=${d}`),
        fetch("/api/tasks"),
        fetch("/api/equipment"),
        fetch(`/api/task-assignments?date=${d}`),
        fetch(`/api/notes?date=${d}`),
      ]);
      const [emps, shifts, tks, eq, asg, nts]: [Employee[], Shift[], Task[], EquipmentUnit[], TaskAssignment[], Note[]] =
        await Promise.all([empRes.json(), shiftRes.json(), taskRes.json(), eqRes.json(), asgRes.json(), noteRes.json()]);
      const map: Record<number, Shift> = {};
      for (const shift of shifts) map[shift.employee_id] = shift;
      setEmployees(emps.filter((employee) => employee.active));
      setShiftMap(map);
      setTasks(tks);
      setEquipment(eq);
      setAssignments(asg);
      setNotes(nts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  function empAssignments(shiftId: number) {
    return assignments.filter((assignment) => assignment.shift_id === shiftId).sort((left, right) => left.position - right.position);
  }

  function totalAllocated(shiftId: number) {
    return empAssignments(shiftId).reduce((sum, assignment) => sum + Number(assignment.duration), 0);
  }

  function toggleExpand(empId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(empId) ? next.delete(empId) : next.add(empId);
      return next;
    });
  }

  function openAddTask(shiftId: number) {
    setNewTask({ id: 0, shift_id: shiftId, task_id: tasks[0]?.id ?? 0, duration: 1, equipment_unit_id: "" });
    setSaveError("");
    setModalOpen(true);
  }

  function openEditTask(assignment: TaskAssignment) {
    setInlineEditId(assignment.id);
    setInlineTask({
      task_id: assignment.task_id,
      duration: Number(assignment.duration),
      equipment_unit_id: assignment.equipment_unit_id ? String(assignment.equipment_unit_id) : "",
    });
    setSaveError("");
  }

  function cancelInlineEdit() {
    setInlineEditId(null);
    setInlineTask({ task_id: 0, duration: 1, equipment_unit_id: "" });
  }

  async function saveTask() {
    if (!newTask.task_id) {
      setSaveError("Please select a task.");
      return;
    }
    if (newTask.duration <= 0) {
      setSaveError("Duration must be greater than 0.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/task-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shift_id: newTask.shift_id,
          task_id: newTask.task_id,
          duration: newTask.duration,
          position: empAssignments(newTask.shift_id).length,
          equipment_unit_id: newTask.equipment_unit_id ? parseInt(newTask.equipment_unit_id) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Save failed");
      }
      setModalOpen(false);
      load(date);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }
  async function saveInlineTask(assignmentId: number) {
    if (!inlineTask.task_id) {
      setSaveError("Please select a task.");
      return;
    }
    if (inlineTask.duration <= 0) {
      setSaveError("Duration must be greater than 0.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/task-assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: inlineTask.task_id,
          duration: inlineTask.duration,
          equipment_unit_id: inlineTask.equipment_unit_id ? parseInt(inlineTask.equipment_unit_id) : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to update task");
      }
      cancelInlineEdit();
      load(date);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to update task");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAssignment(id: number) {
    await fetch(`/api/task-assignments/${id}`, { method: "DELETE" });
    setAssignments((prev) => prev.filter((assignment) => assignment.id !== id));
    if (inlineEditId === id) cancelInlineEdit();
  }

  async function moveAssignment(assignment: TaskAssignment, direction: "up" | "down") {
    const list = empAssignments(assignment.shift_id);
    const index = list.findIndex((item) => item.id === assignment.id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= list.length) return;
    const current = list[index];
    const target = list[swapIndex];
    await Promise.all([
      fetch(`/api/task-assignments/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: target.position }),
      }),
      fetch(`/api/task-assignments/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: current.position }),
      }),
    ]);
    load(date);
  }

  async function reorderAssignments(shiftId: number, draggedId: number, targetId: number) {
    if (draggedId === targetId) return;
    const list = empAssignments(shiftId);
    const draggedIndex = list.findIndex((item) => item.id === draggedId);
    const targetIndex = list.findIndex((item) => item.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0) return;
    const reordered = [...list];
    const [dragged] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, dragged);
    const changed = reordered
      .map((item, index) => ({ ...item, nextPosition: index }))
      .filter((item) => item.position !== item.nextPosition);
    await Promise.all(
      changed.map((item) =>
        fetch(`/api/task-assignments/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: item.nextPosition }),
        })
      )
    );
    setAssignments((prev) =>
      prev.map((assignment) => {
        const updated = changed.find((item) => item.id === assignment.id);
        return updated ? { ...assignment, position: updated.nextPosition } : assignment;
      })
    );
  }

  async function moveAssignmentToShift(draggedId: number, targetShiftId: number, targetIndex?: number) {
    const dragged = assignments.find((assignment) => assignment.id === draggedId);
    if (!dragged || dragged.shift_id === targetShiftId) return;

    const sourceList = empAssignments(dragged.shift_id).filter((assignment) => assignment.id !== draggedId);
    const destinationList = empAssignments(targetShiftId);
    const insertAt = targetIndex === undefined ? destinationList.length : Math.max(0, Math.min(targetIndex, destinationList.length));

    const normalizedSource = sourceList.map((assignment, index) => ({ ...assignment, nextPosition: index }));
    const destinationWithDragged = [...destinationList];
    destinationWithDragged.splice(insertAt, 0, { ...dragged, shift_id: targetShiftId });
    const normalizedDestination = destinationWithDragged.map((assignment, index) => ({
      ...assignment,
      nextPosition: index,
    }));

    await Promise.all([
      fetch(`/api/task-assignments/${draggedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shift_id: targetShiftId, position: insertAt }),
      }),
      ...normalizedSource
        .filter((assignment) => assignment.position !== assignment.nextPosition)
        .map((assignment) =>
          fetch(`/api/task-assignments/${assignment.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: assignment.nextPosition }),
          })
        ),
      ...normalizedDestination
        .filter((assignment) => assignment.id !== draggedId && assignment.position !== assignment.nextPosition)
        .map((assignment) =>
          fetch(`/api/task-assignments/${assignment.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: assignment.nextPosition }),
          })
        ),
    ]);

    setAssignments((prev) =>
      prev
        .map((assignment) => {
          if (assignment.id === draggedId) {
            return { ...assignment, shift_id: targetShiftId, position: insertAt };
          }
          const sourceUpdate = normalizedSource.find((item) => item.id === assignment.id);
          if (sourceUpdate) return { ...assignment, position: sourceUpdate.nextPosition };
          const destinationUpdate = normalizedDestination.find((item) => item.id === assignment.id);
          if (destinationUpdate) return { ...assignment, position: destinationUpdate.nextPosition };
          return assignment;
        })
        .sort((left, right) => left.shift_id - right.shift_id || left.position - right.position)
    );
  }

  function openNoteModal(note?: Note) {
    setEditingNote(note ?? { date, type: "daily", content: "" });
    setNoteError("");
    setNoteModalOpen(true);
  }

  async function saveNote() {
    if (!editingNote.content?.trim()) {
      setNoteError("Please enter note content.");
      return;
    }
    setNoteSaving(true);
    setNoteError("");
    try {
      const res = await fetch(editingNote.id ? `/api/notes/${editingNote.id}` : "/api/notes", {
        method: editingNote.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingNote),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to save note");
      }
      setNoteModalOpen(false);
      load(date);
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : "Failed to save note");
    } finally {
      setNoteSaving(false);
    }
  }

  async function deleteNote(id: number) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((note) => note.id !== id));
  }

  const scheduledCount = employees.filter((employee) => shiftMap[employee.id] && !shiftMap[employee.id].is_day_off).length;
  const assignedCount = assignments.length;
  const unassignedScheduled = employees.filter((employee) => {
    const shift = shiftMap[employee.id];
    return shift && !shift.is_day_off && empAssignments(shift.id).length === 0;
  }).length;
  const taskSummary = tasks
    .map((task) => ({
      id: task.id,
      name: task.name,
      group_name: task.group_name,
      count: assignments.filter((assignment) => assignment.task_id === task.id).length,
    }))
    .filter((task) => task.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
  const noteGroups = ["daily", "general", "alert"].map((type) => ({
    type,
    notes: notes.filter((note) => (note.type ?? "general") === type),
  }));
  const readyEquipmentGroups = equipment
    .filter((unit) => unit.status === "ready")
    .reduce<Record<string, EquipmentUnit[]>>((acc, unit) => {
      const key = unit.type_name || "Other Equipment";
      (acc[key] ??= []).push(unit);
      return acc;
    }, {});

  return (
    <div className="workboard-stage mx-auto max-w-5xl rounded-[2rem] p-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Workboard</h1>
          <p className="page-sub">
            {format(new Date(date + "T00:00:00"), "EEEE, MMMM d")}
            {!loading && <span className="ml-2 text-gray-400">- {scheduledCount} scheduled</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(formatDate(subDays(new Date(date + "T00:00:00"), 1)))} className="btn-nav">Prev</button>
          <button onClick={() => setDate(formatDate(new Date()))} className="btn-nav">Today</button>
          <button onClick={() => setDate(formatDate(addDays(new Date(date + "T00:00:00"), 1)))} className="btn-nav">Next</button>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="input w-40 text-sm" />
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saveError && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{saveError}</div>}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
        <div className="workboard-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">How To Use This Page</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Assign work only after labor is scheduled.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Open each employee row to add tasks, edit durations inline, attach equipment, and drag priority into the right order for the breakroom screen.</p>
        </div>
        <div className="workboard-panel p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Scheduled Crew</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{scheduledCount}</p><p className="mt-1 text-sm text-slate-500">Employees available for tasking</p></div>
        <div className="workboard-panel p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Assigned Tasks</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{assignedCount}</p><p className="mt-1 text-sm text-slate-500">Tasks built for this date</p></div>
        <div className="workboard-panel p-5"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">Needs Assignment</p><p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{unassignedScheduled}</p><p className="mt-1 text-sm text-slate-500">Scheduled employees with no tasks yet</p></div>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="workboard-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">Labor Board Focus</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-sm font-semibold text-slate-900">Coverage</p><p className="mt-1 text-sm text-slate-600">Only scheduled employees should receive work here.</p></div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-sm font-semibold text-slate-900">Priority</p><p className="mt-1 text-sm text-slate-600">Drag tasks up or down. The top task becomes the first thing crews see in breakroom.</p></div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3"><p className="text-sm font-semibold text-slate-900">Editing</p><p className="mt-1 text-sm text-slate-600">Use Edit inside a row to change task, hours, or equipment without leaving the page.</p></div>
          </div>
        </div>
        <div className="workboard-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Top Assigned Tasks</p>
          <div className="mt-4 space-y-3">
            {taskSummary.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">No task assignments for this date yet.</div>
            ) : (
              taskSummary.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div><p className="text-sm font-semibold text-slate-900">{task.name}</p><p className="text-xs text-slate-500">{task.group_name || "Ungrouped task"}</p></div>
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{task.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="workboard-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700">Daily Notes And Alerts</p><p className="mt-1 text-sm text-slate-600">These notes also appear on the breakroom screen for the selected day.</p></div>
            <button onClick={() => openNoteModal()} className="btn-secondary text-xs">Add Note</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {noteGroups.map((group) => (
              <div key={group.type} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{group.type}</p>
                <div className="mt-3 space-y-2">
                  {group.notes.length === 0 ? <p className="text-sm text-slate-400">No notes yet.</p> : group.notes.map((note) => (
                    <div key={note.id} className="rounded-xl bg-white px-3 py-3 shadow-sm">
                      <p className="text-sm text-slate-700">{note.content}</p>
                      <div className="mt-3 flex items-center gap-3 text-xs font-medium"><button onClick={() => openNoteModal(note)} className="text-emerald-700 hover:text-emerald-900">Edit</button><button onClick={() => deleteNote(note.id)} className="text-red-600 hover:text-red-800">Delete</button></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="workboard-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">Downstream View</p>
          <div className="mt-4 space-y-3">
            <a href="/breakroom" className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50">Preview today&apos;s breakroom board</a>
            <a href="/reports" className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50">Review labor and task reports</a>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {loading ? Array.from({ length: 5 }).map((_, index) => <SkeletonCard key={index} />) : employees.map((employee) => {
          const shift = shiftMap[employee.id];
          const isExpanded = expanded.has(employee.id);
          const asgList = shift ? empAssignments(shift.id) : [];
          const shiftHrs = shift ? shiftDurationHours(shift.start_time, shift.end_time) : 0;
          const allocated = shift ? totalAllocated(shift.id) : 0;
          const remaining = shiftHrs - allocated;
          const isOver = remaining < -0.01;
          const isDone = Math.abs(remaining) < 0.01 && shiftHrs > 0;
          return (
            <div key={employee.id} className="labor-card">
              <div className="labor-card-header flex cursor-pointer items-center px-4 py-4 transition-colors select-none hover:bg-slate-50" onClick={() => toggleExpand(employee.id)}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-gray-900">{employee.first_name} {employee.last_name}</span>{employee.worker_type && <span className="text-xs text-gray-400">{employee.worker_type}</span>}</div>
                  {shift && !shift.is_day_off && <><div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500"><span>{shiftHrs.toFixed(1)}h shift</span><span className={isOver ? "font-medium text-red-500" : isDone ? "font-medium text-emerald-600" : "text-amber-600"}>{isOver ? `${Math.abs(remaining).toFixed(1)}h over` : isDone ? "Fully allocated" : `${remaining.toFixed(1)}h remaining`}</span></div><HoursBar allocated={allocated} total={shiftHrs} /></>}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">{!shift && <span className="badge bg-gray-100 text-gray-400">No shift</span>}{shift?.is_day_off && <span className="badge bg-gray-100 text-gray-400">Day off</span>}{isDone && <span className="badge bg-emerald-100 text-emerald-700">Complete</span>}{isOver && <span className="badge bg-red-100 text-red-600">Over</span>}<svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg></div>
              </div>
              {isExpanded && (
                <div className="space-y-1.5 border-t border-gray-100 px-4 pb-3 pt-2" onDragOver={(event) => { if (shift && !shift.is_day_off) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={async (event) => { event.preventDefault(); const draggedId = dragAssignmentId ?? Number(event.dataTransfer.getData("text/plain")); if (shift && !shift.is_day_off && draggedId) { const dragged = assignments.find((item) => item.id === draggedId); if (dragged && dragged.shift_id !== shift.id) await moveAssignmentToShift(draggedId, shift.id); setDragAssignmentId(null); setDropTargetId(null); } }}>
                  {shift && !shift.is_day_off ? (
                    <>
                      {asgList.length === 0 && <p className="rounded-lg border border-dashed border-brand-200 py-3 text-center text-xs italic text-gray-400">No tasks assigned yet. Drag a task here from another employee or add a new task below.</p>}
                        {asgList.map((assignment, index) => {
                          const isEditing = inlineEditId === assignment.id;
                          const isDropTarget = dropTargetId === assignment.id && dragAssignmentId !== assignment.id;
                          return (
                          <div key={assignment.id} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (dragAssignmentId !== assignment.id) setDropTargetId(assignment.id); }} onDrop={async (event) => { event.preventDefault(); const draggedId = dragAssignmentId ?? Number(event.dataTransfer.getData("text/plain")); if (draggedId) { const dragged = assignments.find((item) => item.id === draggedId); if (dragged?.shift_id === assignment.shift_id) { await reorderAssignments(assignment.shift_id, draggedId, assignment.id); } else { await moveAssignmentToShift(draggedId, assignment.shift_id, index); } } setDragAssignmentId(null); setDropTargetId(null); }} className={`task-row ${index === 0 ? "task-row-priority" : ""} ${isDropTarget ? "border-brand-300 bg-brand-50 shadow-sm" : ""}`}>
                            {isDropTarget && <div className="task-drop-indicator">Drop Task Here</div>}
                            {isEditing ? (
                              <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_120px_minmax(0,1fr)_auto] md:items-end">
                                <div><label className="label">Task</label><select className="input" value={inlineTask.task_id} onChange={(event) => setInlineTask((prev) => ({ ...prev, task_id: parseInt(event.target.value) }))}><option value={0} disabled>Select a task...</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.group_name ? `${task.group_name} > ` : ""}{task.name}</option>)}</select></div>
                                <div><label className="label">Hours</label><input className="input" type="number" step="0.25" min="0.25" max="24" value={inlineTask.duration} onChange={(event) => setInlineTask((prev) => ({ ...prev, duration: parseFloat(event.target.value) || 0 }))} /></div>
                                <div><label className="label">Equipment</label><select className="input" value={inlineTask.equipment_unit_id} onChange={(event) => setInlineTask((prev) => ({ ...prev, equipment_unit_id: event.target.value }))}><option value="">None</option>{Object.entries(readyEquipmentGroups).map(([groupName, units]) => <optgroup key={groupName} label={groupName}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_name}</option>)}</optgroup>)}</select></div>
                                <div className="flex items-center gap-2 md:justify-end"><button onClick={() => saveInlineTask(assignment.id)} disabled={saving} className="btn-primary text-xs">{saving ? "Saving..." : "Save"}</button><button onClick={cancelInlineEdit} className="btn-secondary text-xs">Cancel</button></div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" draggable onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(assignment.id)); setDragAssignmentId(assignment.id); setDropTargetId(assignment.id); }} onDragEnd={() => { setDragAssignmentId(null); setDropTargetId(null); }} className="cursor-grab rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-700 hover:border-brand-300 hover:bg-brand-100 active:cursor-grabbing" aria-label={`Drag ${assignment.task_name ?? "task"} to reorder or reassign`}>Drag</button>
                                <span className="w-4 shrink-0 text-xs text-gray-300">{index + 1}</span>
                                <span className="min-w-[160px] flex-1 text-sm font-medium text-gray-800">{assignment.task_name}</span>
                                <span className="shrink-0 font-mono text-xs text-brand-600">{Number(assignment.duration).toFixed(1)}h</span>
                                {assignment.equipment_unit_name && <span className="badge shrink-0 bg-sky-100 text-sky-700">{assignment.equipment_unit_name}</span>}
                                <div className="task-actions ml-auto">
                                  <button onClick={() => moveAssignment(assignment, "up")} disabled={index === 0} className="rounded-md border border-slate-200 px-2 py-1 text-xs leading-none text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-30">Up</button>
                                  <button onClick={() => moveAssignment(assignment, "down")} disabled={index === asgList.length - 1} className="rounded-md border border-slate-200 px-2 py-1 text-xs leading-none text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-30">Down</button>
                                  <button onClick={() => openEditTask(assignment)} className="rounded-md border border-emerald-200 px-2 py-1 text-xs leading-none text-emerald-700 transition hover:bg-emerald-50">Edit</button>
                                  <button onClick={() => deleteAssignment(assignment.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs leading-none text-red-600 transition hover:bg-red-50">Delete</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button onClick={() => openAddTask(shift.id)} className="mt-1 w-full rounded-lg border border-dashed border-brand-200 py-2 text-xs text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-800">+ Add Task</button>
                    </>
                  ) : (
                    <p className="py-2 text-xs italic text-gray-400">{shift?.is_day_off ? "Employee has the day off." : "No shift scheduled. Set a shift in the Scheduler first."}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && employees.length === 0 && <div className="card py-14 text-center text-sm text-gray-400">No active employees found.</div>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Task">
        <div className="space-y-4">
          {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>}
          <div><label className="label">Task</label><select className="input" value={newTask.task_id} onChange={(event) => setNewTask((prev) => ({ ...prev, task_id: parseInt(event.target.value) }))}><option value={0} disabled>Select a task...</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.group_name ? `${task.group_name} > ` : ""}{task.name}</option>)}</select></div>
          <div><label className="label">Duration (hours)</label><input className="input" type="number" step="0.25" min="0.25" max="24" value={newTask.duration} onChange={(event) => setNewTask((prev) => ({ ...prev, duration: parseFloat(event.target.value) || 0 }))} /></div>
          <div><label className="label">Equipment Unit <span className="font-normal normal-case text-gray-400">(optional)</span></label><select className="input" value={newTask.equipment_unit_id} onChange={(event) => setNewTask((prev) => ({ ...prev, equipment_unit_id: event.target.value }))}><option value="">None</option>{Object.entries(readyEquipmentGroups).map(([groupName, units]) => <optgroup key={groupName} label={groupName}>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_name}</option>)}</optgroup>)}</select></div>
          <div className="flex justify-end gap-2 pt-2"><button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button><button onClick={saveTask} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Add Task"}</button></div>
        </div>
      </Modal>

      <Modal open={noteModalOpen} onClose={() => setNoteModalOpen(false)} title={editingNote.id ? "Edit Note" : "Add Note"}>
        <div className="space-y-4">
          {noteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{noteError}</p>}
          <div><label className="label">Type</label><select className="input" value={editingNote.type ?? "daily"} onChange={(event) => setEditingNote((prev) => ({ ...prev, date, type: event.target.value }))}><option value="daily">Daily</option><option value="general">General</option><option value="alert">Alert</option></select></div>
          <div><label className="label">Message</label><textarea className="input min-h-32 resize-y" value={editingNote.content ?? ""} onChange={(event) => setEditingNote((prev) => ({ ...prev, date, content: event.target.value }))} /></div>
          <div className="flex justify-end gap-2 pt-2"><button onClick={() => setNoteModalOpen(false)} className="btn-secondary">Cancel</button><button onClick={saveNote} disabled={noteSaving} className="btn-primary">{noteSaving ? "Saving..." : "Save Note"}</button></div>
        </div>
      </Modal>
    </div>
  );
}
