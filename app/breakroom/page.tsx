"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format, subDays } from "date-fns";
import { Employee, Shift, TaskAssignment, Note } from "@/lib/types";
import { formatDate, formatTime, shiftDurationHours } from "@/lib/utils";
import BrandText from "@/components/BrandText";

type CrewCard = {
  employee: Employee;
  shift: Shift;
  assignments: TaskAssignment[];
  allocatedHours: number;
};

function cardTone(index: number) {
  const tones = [
    "from-sky-400/25 to-cyan-400/10 border-sky-200",
    "from-violet-400/25 to-fuchsia-400/10 border-violet-200",
    "from-emerald-400/25 to-teal-400/10 border-emerald-200",
    "from-amber-400/25 to-orange-400/10 border-amber-200",
  ];
  return tones[index % tones.length];
}

export default function BreakroomPage() {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (selectedDate: string) => {
    setLoading(true);
    setError("");
    try {
      const [employeesRes, shiftsRes, assignmentsRes, notesRes] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/shifts?start=${selectedDate}&end=${selectedDate}`),
        fetch(`/api/task-assignments?date=${selectedDate}`),
        fetch(`/api/notes?date=${selectedDate}`),
      ]);

      if (!employeesRes.ok || !shiftsRes.ok || !assignmentsRes.ok || !notesRes.ok) {
        throw new Error("Failed to load breakroom data");
      }

      const [employeesData, shiftsData, assignmentsData, notesData]: [Employee[], Shift[], TaskAssignment[], Note[]] = await Promise.all([
        employeesRes.json(),
        shiftsRes.json(),
        assignmentsRes.json(),
        notesRes.json(),
      ]);

      setEmployees(employeesData.filter((employee) => employee.active));
      setShifts(shiftsData.filter((shift) => !shift.is_day_off));
      setAssignments(assignmentsData);
      setNotes(notesData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const cards = useMemo<CrewCard[]>(() => {
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));

    return shifts
      .map((shift) => {
        const employee = employeeMap.get(shift.employee_id);
        if (!employee) return null;
        const rowAssignments = assignments
          .filter((assignment) => assignment.shift_id === shift.id)
          .sort((left, right) => left.position - right.position);
        return {
          employee,
          shift,
          assignments: rowAssignments,
          allocatedHours: rowAssignments.reduce((sum, assignment) => sum + Number(assignment.duration), 0),
        };
      })
      .filter((card): card is CrewCard => Boolean(card))
      .sort((left, right) => {
        if (left.assignments.length === 0 && right.assignments.length > 0) return 1;
        if (right.assignments.length === 0 && left.assignments.length > 0) return -1;
        return left.employee.last_name.localeCompare(right.employee.last_name);
      });
  }, [assignments, employees, shifts]);

  const totalScheduled = cards.length;
  const totalAssignedTasks = cards.reduce((sum, card) => sum + card.assignments.length, 0);
  const totalAssignedHours = cards.reduce((sum, card) => sum + card.allocatedHours, 0);
  const noteGroups = ["daily", "general", "alert"].map((type) => ({
    type,
    notes: notes.filter((note) => (note.type ?? "general") === type),
  }));

  return (
    <div className="px-5 py-6 lg:px-8">
      <section className="mb-5 overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_#07111f_0%,_rgb(var(--brand-700))_34%,_rgb(var(--brand-600))_66%,_rgb(var(--accent-500))_100%)] px-6 py-6 text-white shadow-[0_30px_80px_-50px_rgba(15,23,42,0.82)]">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60"><BrandText field="companyName" /> Breakroom</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Give crews a clear plan they can read from across the room.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/80"><BrandText field="breakroomFocus" /></p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-white/75">
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2"><BrandText field="clientLabel" /></span>
              <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2">{format(new Date(`${date}T00:00:00`), "EEEE, MMMM d, yyyy")}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">Scheduled crew</p>
              <p className="mt-2 text-2xl font-semibold">{totalScheduled}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">Task hours</p>
              <p className="mt-2 text-2xl font-semibold">{totalAssignedHours.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="page-header">
        <div>
          <h1 className="page-title">Breakroom</h1>
          <p className="page-sub">Wallboard view for crews to see today&apos;s shifts, priorities, and assigned tasks.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(formatDate(subDays(new Date(`${date}T00:00:00`), 1)))} className="btn-nav">Prev</button>
          <button onClick={() => setDate(formatDate(new Date()))} className="btn-nav">Today</button>
          <button onClick={() => setDate(formatDate(addDays(new Date(`${date}T00:00:00`), 1)))} className="btn-nav">Next</button>
          <input className="input w-40 text-sm" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">How To Use This Page</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Show crews their priorities at a glance.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This screen turns scheduled shifts and workboard assignments into a display-ready breakroom board with the top task shown first for every employee.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Scheduled Today</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{totalScheduled}</p>
          <p className="mt-1 text-sm text-slate-500">Crew members on the board</p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Assigned Tasks</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{totalAssignedTasks}</p>
          <p className="mt-1 text-sm text-slate-500">Tasks flowing from the workboard</p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Assigned Hours</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{totalAssignedHours.toFixed(1)}</p>
          <p className="mt-1 text-sm text-slate-500">Total task hours shown on this screen</p>
        </div>
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Breakroom Board</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{format(new Date(`${date}T00:00:00`), "EEEE, MMMM d, yyyy")}</h2>
            </div>
            <p className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              Priorities sorted by employee
            </p>
          </div>

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {loading ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="card animate-pulse">
                  <div className="h-32 bg-slate-100" />
                </div>
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-semibold tracking-tight text-slate-900">No scheduled crew for this day yet.</p>
              <p className="mt-2 text-sm text-slate-500">Schedule labor first, then assign work to populate the breakroom board.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {cards.map((card, index) => {
                const shiftHours = shiftDurationHours(card.shift.start_time, card.shift.end_time);
                const topTask = card.assignments[0];
                return (
                  <div
                    key={card.shift.id}
                    className={`overflow-hidden rounded-[1.5rem] border bg-gradient-to-br ${cardTone(index)} shadow-sm`}
                  >
                    <div className="border-b border-white/60 bg-white/80 px-5 py-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-2xl font-semibold tracking-tight text-slate-900">
                            {card.employee.first_name} {card.employee.last_name}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {formatTime(card.shift.start_time)} - {formatTime(card.shift.end_time)} · {shiftHours.toFixed(1)}h shift
                          </p>
                        </div>
                        <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                          {card.assignments.length > 0 ? "Assigned" : "Open"}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 bg-white/90 px-5 py-4">
                      {topTask ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Priority Task</p>
                          <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{topTask.task_name}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {Number(topTask.duration).toFixed(1)}h
                            {topTask.equipment_unit_name ? ` · ${topTask.equipment_unit_name}` : ""}
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                          No tasks assigned yet for this shift.
                        </div>
                      )}

                      <div className="space-y-2">
                        {card.assignments.slice(1).map((assignment, assignmentIndex) => (
                          <div key={assignment.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                {assignmentIndex + 2}. {assignment.task_name}
                              </p>
                              <p className="text-xs text-slate-500">
                                {assignment.equipment_unit_name || "No equipment assigned"}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">{Number(assignment.duration).toFixed(1)}h</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-700">Notes And Alerts</p>
            <div className="mt-4 space-y-3">
              {noteGroups.map((group) => (
                <div key={group.type} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{group.type}</p>
                  <div className="mt-2 space-y-2">
                    {group.notes.length === 0 ? (
                      <p className="text-sm text-slate-400">No notes posted.</p>
                    ) : (
                      group.notes.map((note) => (
                        <p key={note.id} className="rounded-xl bg-white px-3 py-3 text-sm text-slate-700 shadow-sm">{note.content}</p>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Daily Handoff</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Keep the workflow connected</h2>
            <div className="mt-4 space-y-3">
              <Link href="/scheduler" className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:bg-emerald-50">
                1. Review labor in Scheduler
              </Link>
              <Link href="/workboard" className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:border-cyan-300 hover:bg-cyan-50">
                2. Assign tasks in Workboard
              </Link>
              <Link href="/reports" className="block rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 hover:border-amber-300 hover:bg-amber-50">
                3. Review outcomes in Reports
              </Link>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700">Breakroom Snapshot</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{cards.filter((card) => card.assignments.length === 0).length}</p>
                <p>Crew members still missing task assignments</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{cards.filter((card) => card.assignments.length > 1).length}</p>
                <p>Crew members carrying multiple priorities</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{cards.filter((card) => card.assignments.some((assignment) => assignment.equipment_unit_name)).length}</p>
                <p>Crew members with equipment already tied to tasks</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
