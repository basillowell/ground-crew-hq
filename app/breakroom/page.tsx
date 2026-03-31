"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, format, subDays } from "date-fns";
import { Employee, Shift, TaskAssignment } from "@/lib/types";
import { formatDate, shiftDurationHours } from "@/lib/utils";

type BreakroomEmployee = {
  employee: Employee;
  shift: Shift;
  assignments: TaskAssignment[];
  totalHours: number;
  priorityTask: TaskAssignment | null;
};

const WEATHER_METRICS = [
  { label: "Current Conditions", value: "Partly Cloudy", sub: "71F" },
  { label: "Forecast", value: "Warm Afternoon", sub: "High 82F" },
];

const AIR_QUALITY = [
  { hour: "8:00", value: 48, tone: "bg-emerald-400" },
  { hour: "9:00", value: 51, tone: "bg-lime-400" },
  { hour: "10:00", value: 40, tone: "bg-green-400" },
  { hour: "11:00", value: 56, tone: "bg-amber-400" },
];

function initials(employee: Employee) {
  return `${employee.first_name[0] ?? ""}${employee.last_name[0] ?? ""}`.toUpperCase();
}

function accentFor(employee: Employee) {
  const palette = [
    "from-sky-400 to-cyan-300",
    "from-violet-400 to-indigo-300",
    "from-emerald-400 to-teal-300",
    "from-amber-400 to-orange-300",
  ];
  return palette[employee.group_id ? employee.group_id % palette.length : employee.id % palette.length];
}

function buildMap<T extends { shift_id: number }>(rows: T[]) {
  return rows.reduce<Record<number, T[]>>((acc, row) => {
    if (!acc[row.shift_id]) acc[row.shift_id] = [];
    acc[row.shift_id].push(row);
    return acc;
  }, {});
}

function NoteRow({ title, body, translated }: { title: string; body: string; translated?: string }) {
  return (
    <div className="border-b border-slate-200/70 px-4 py-3 last:border-b-0">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className="mt-2 text-base font-medium text-slate-800">{body}</div>
      {translated && <div className="mt-2 text-sm text-slate-500">{translated}</div>}
    </div>
  );
}

function CalendarStrip({ selectedDate }: { selectedDate: string }) {
  const current = new Date(`${selectedDate}T00:00:00`);
  const days = Array.from({ length: 7 }, (_, index) => addDays(subDays(current, 2), index));

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-7">
      {days.map((day) => {
        const dayValue = formatDate(day);
        const active = dayValue === selectedDate;
        return (
          <div
            key={dayValue}
            className={`rounded-2xl border px-4 py-3 text-center shadow-sm transition-colors ${
              active
                ? "border-sky-400 bg-sky-50 text-sky-900"
                : "border-white/70 bg-white/70 text-slate-500"
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.18em]">{format(day, "EEEE")}</div>
            <div className={`mt-2 text-3xl font-black ${active ? "text-slate-900" : "text-slate-400"}`}>
              {format(day, "d")}
            </div>
            <div className="text-sm">{format(day, "MMM yyyy")}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function BreakroomPage() {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (selectedDate: string) => {
    setLoading(true);
    setError("");
    try {
      const [employeeRes, shiftRes, assignmentRes] = await Promise.all([
        fetch("/api/employees"),
        fetch(`/api/shifts?start=${selectedDate}&end=${selectedDate}`),
        fetch(`/api/task-assignments?date=${selectedDate}`),
      ]);
      if (!employeeRes.ok || !shiftRes.ok || !assignmentRes.ok) {
        throw new Error("Failed to load breakroom data");
      }

      const [employeeRows, shiftRows, assignmentRows]: [Employee[], Shift[], TaskAssignment[]] = await Promise.all([
        employeeRes.json(),
        shiftRes.json(),
        assignmentRes.json(),
      ]);

      setEmployees(employeeRows.filter((employee) => employee.active));
      setShifts(shiftRows.filter((shift) => !shift.is_day_off));
      setAssignments(assignmentRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const board = useMemo<BreakroomEmployee[]>(() => {
    const employeeMap = new Map(employees.map((employee) => [employee.id, employee]));
    const assignmentMap = buildMap(assignments);
    const rows: BreakroomEmployee[] = [];

    for (const shift of shifts) {
      const employee = employeeMap.get(shift.employee_id);
      if (!employee) continue;
      const employeeAssignments = (assignmentMap[shift.id] ?? []).slice().sort((a, b) => a.position - b.position);
      rows.push({
        employee,
        shift,
        assignments: employeeAssignments,
        totalHours: shiftDurationHours(shift.start_time, shift.end_time),
        priorityTask: employeeAssignments[0] ?? null,
      });
    }

    return rows.sort((a, b) => {
        const aPriority = a.priorityTask ? a.priorityTask.position : Number.MAX_SAFE_INTEGER;
        const bPriority = b.priorityTask ? b.priorityTask.position : Number.MAX_SAFE_INTEGER;
        return aPriority - bPriority || a.employee.last_name.localeCompare(b.employee.last_name);
      });
  }, [assignments, employees, shifts]);

  const totals = useMemo(() => {
    const assignedTasks = board.reduce((sum, row) => sum + row.assignments.length, 0);
    const assignedHours = board.reduce(
      (sum, row) => sum + row.assignments.reduce((acc, task) => acc + Number(task.duration), 0),
      0
    );
    const priorityCount = board.filter((row) => row.priorityTask).length;
    return {
      crew: board.length,
      assignedTasks,
      assignedHours,
      priorityCount,
    };
  }, [board]);

  const notes = useMemo(() => {
    const firstPriority = board.find((row) => row.priorityTask)?.priorityTask?.task_name ?? "Morning prep";
    const secondPriority =
      board.find((row) => row.assignments[1])?.assignments[1]?.task_name ?? "Secondary assignments";
    return [
      {
        title: "Daily Note",
        body: `Priority launch starts with ${firstPriority}. Crew leads should confirm all top tasks before 8:00 AM.`,
        translated: "Prioridad del dia: confirmar las tareas principales antes de las 8:00 AM.",
      },
      {
        title: "General Note",
        body: `Keep equipment staged for ${secondPriority.toLowerCase()}. Report issues before reassignment.`,
      },
      {
        title: "Safety Callout",
        body: "Hydration, radio checks, and PPE review before leaving the breakroom.",
      },
    ];
  }, [board]);

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(186,230,253,0.45),_transparent_38%),linear-gradient(180deg,_#eef4f8_0%,_#f7fbfd_45%,_#edf4ea_100%)] p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.35em] text-slate-500">Breakroom Board</div>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
              Team task priorities at a glance
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Built for wall-display readability with priority-first task cards, live staffing, and shared crew
              notes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setDate(formatDate(subDays(new Date(`${date}T00:00:00`), 1)))}
              className="btn-nav bg-white/80"
            >
              Prev
            </button>
            <button onClick={() => setDate(formatDate(new Date()))} className="btn-nav bg-white/80">
              Today
            </button>
            <button
              onClick={() => setDate(formatDate(addDays(new Date(`${date}T00:00:00`), 1)))}
              className="btn-nav bg-white/80"
            >
              Next
            </button>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="input w-44 border-white/60 bg-white/85"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="overflow-hidden rounded-[28px] bg-[#1f232c] text-white shadow-[0_20px_45px_-25px_rgba(15,23,42,0.6)]">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Operations Date</div>
                <div className="mt-2 flex items-center justify-between text-lg font-bold">
                  <span>{format(new Date(`${date}T00:00:00`), "MM-dd-yyyy")}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                    Live
                  </span>
                </div>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Weather Forecast
                  </div>
                  <div className="mt-3 grid gap-3">
                    {WEATHER_METRICS.map((metric) => (
                      <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                          {metric.label}
                        </div>
                        <div className="mt-2 text-xl font-bold">{metric.value}</div>
                        <div className="text-sm text-slate-300">{metric.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Air Quality</div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {AIR_QUALITY.map((slot) => (
                      <div key={slot.hour} className="rounded-2xl bg-white/5 px-2 py-3 text-center">
                        <div className={`mx-auto h-2 w-10 rounded-full ${slot.tone}`} />
                        <div className="mt-2 text-lg font-bold">{slot.value}</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{slot.hour}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Move Patterns
                  </div>
                  <div className="mt-3 rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.45),_transparent_30%),linear-gradient(180deg,_rgba(59,130,246,0.12),_rgba(15,23,42,0.2))] px-4 py-5">
                    <div className="mx-auto flex h-60 w-28 items-center justify-center rounded-[999px] border-4 border-emerald-300/50 bg-[linear-gradient(180deg,_rgba(132,204,22,0.95),_rgba(34,197,94,0.75))]">
                      <div className="grid h-40 w-16 gap-3 rounded-[999px] bg-emerald-200/30 p-3">
                        <div className="rounded-full border border-lime-100/70 bg-lime-200/40" />
                        <div className="rounded-full border border-lime-100/70 bg-lime-200/30" />
                        <div className="rounded-full border border-lime-100/70 bg-lime-200/20" />
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] uppercase tracking-[0.18em] text-slate-300">
                      <div className="rounded-xl bg-white/5 px-2 py-2">Greens</div>
                      <div className="rounded-xl bg-white/5 px-2 py-2">Fairways</div>
                      <div className="rounded-xl bg-white/5 px-2 py-2">Tees</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </aside>

          <section className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Crew on board</div>
                <div className="mt-3 text-4xl font-black text-slate-900">{loading ? "--" : totals.crew}</div>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assigned tasks</div>
                <div className="mt-3 text-4xl font-black text-slate-900">
                  {loading ? "--" : totals.assignedTasks}
                </div>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Planned hours</div>
                <div className="mt-3 text-4xl font-black text-slate-900">
                  {loading ? "--" : totals.assignedHours.toFixed(1)}
                </div>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Priority leaders
                </div>
                <div className="mt-3 text-4xl font-black text-slate-900">
                  {loading ? "--" : totals.priorityCount}
                </div>
              </div>
            </div>

            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-4 md:grid-cols-2">
                {loading &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="overflow-hidden rounded-[30px] border border-white/80 bg-white/75 shadow-sm"
                    >
                      <div className="h-2 animate-pulse bg-slate-200" />
                      <div className="space-y-3 px-5 py-5">
                        <div className="h-10 rounded-2xl bg-slate-100" />
                        <div className="h-16 rounded-2xl bg-slate-100" />
                        <div className="h-12 rounded-2xl bg-slate-100" />
                      </div>
                    </div>
                  ))}

                {!loading &&
                  board.map((row) => {
                    const allocated = row.assignments.reduce(
                      (sum, assignment) => sum + Number(assignment.duration),
                      0
                    );
                    const loadPercent = row.totalHours > 0 ? Math.min((allocated / row.totalHours) * 100, 100) : 0;
                    return (
                      <article
                        key={row.shift.id}
                        className="overflow-hidden rounded-[30px] border border-white/80 bg-white/80 shadow-[0_18px_35px_-28px_rgba(15,23,42,0.45)] backdrop-blur"
                      >
                        <div className={`h-2 bg-gradient-to-r ${accentFor(row.employee)}`} />
                        <div className="px-5 py-5">
                          <div className="flex items-center gap-4">
                            <div
                              className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${accentFor(row.employee)} text-xl font-black text-slate-900 shadow-sm`}
                            >
                              {initials(row.employee)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-3xl font-black tracking-tight text-slate-900">
                                {row.employee.first_name} {row.employee.last_name}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                <span>{row.employee.group_name ?? "Crew assignment pending"}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                <span>
                                  {row.shift.start_time} - {row.shift.end_time}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                            {row.assignments.length > 0 ? (
                              row.assignments.slice(0, 4).map((assignment, index) => (
                                <div
                                  key={assignment.id}
                                  className={`flex items-start gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0 ${
                                    index === 0 ? "bg-emerald-50/70" : "bg-white"
                                  }`}
                                >
                                  <div
                                    className={`mt-1 h-5 w-1.5 rounded-full ${
                                      index === 0 ? "bg-emerald-400" : "bg-slate-200"
                                    }`}
                                  />
                                  <div className="w-7 text-2xl font-black text-slate-400">{index + 1}</div>
                                  <div className="min-w-0 flex-1">
                                    <div
                                      className={`leading-tight ${
                                        index === 0
                                          ? "text-[2rem] font-black text-slate-900"
                                          : "text-xl font-semibold text-slate-800"
                                      }`}
                                    >
                                      {assignment.task_name}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                                      <span>{Number(assignment.duration).toFixed(2)} hrs</span>
                                      {assignment.equipment_unit_name && (
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                                          {assignment.equipment_unit_name}
                                        </span>
                                      )}
                                      {index === 0 && (
                                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                                          Priority
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="px-4 py-8 text-center text-slate-400">
                                No tasks assigned yet for this shift.
                              </div>
                            )}
                          </div>

                          <div className="mt-4 rounded-2xl bg-slate-100/90 px-4 py-3">
                            <div className="flex items-center justify-between text-sm text-slate-500">
                              <span>Shift load</span>
                              <span className="font-semibold text-slate-700">
                                {allocated.toFixed(1)} / {row.totalHours.toFixed(1)} hrs
                              </span>
                            </div>
                            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                                style={{ width: `${loadPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                {!loading && board.length === 0 && (
                  <div className="rounded-[30px] border border-white/80 bg-white/80 px-6 py-12 text-center text-slate-500 shadow-sm md:col-span-2">
                    No scheduled crew found for this date. Add shifts and task assignments to populate the breakroom
                    board.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/85 shadow-sm backdrop-blur">
                  <div className="bg-slate-600 px-4 py-3 text-lg font-bold text-white">Notes</div>
                  {notes.map((note) => (
                    <NoteRow key={note.title} title={note.title} body={note.body} translated={note.translated} />
                  ))}
                </section>

                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/85 shadow-sm backdrop-blur">
                  <div className="bg-slate-700 px-4 py-3 text-lg font-bold text-white">No Accidents</div>
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    {[
                      { label: "days", value: 92 },
                      { label: "hours", value: 11 },
                      { label: "minutes", value: 27 },
                      { label: "seconds", value: 42 },
                    ].map((metric) => (
                      <div key={metric.label} className="px-3 py-5 text-center">
                        <div className="text-4xl font-black text-slate-900">{metric.value}</div>
                        <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {metric.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <CalendarStrip selectedDate={date} />
          </section>
        </div>
      </div>
    </div>
  );
}
