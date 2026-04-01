import Link from "next/link";
import { query } from "@/lib/db";
import { formatDate } from "@/lib/utils";

type DashboardStats = {
  activeEmployees: number;
  scheduledToday: number;
  assignedJobsToday: number;
  readyEquipment: number;
  taskCount: number;
};

async function getStats(): Promise<DashboardStats | null> {
  try {
    const today = formatDate(new Date());
    const [employees, shifts, assignments, equipment, tasks] = await Promise.all([
      query<{ count: string }>("SELECT COUNT(*)::int AS count FROM employees WHERE active = true"),
      query<{ count: string }>("SELECT COUNT(*)::int AS count FROM shifts WHERE date = $1 AND is_day_off = false", [today]),
      query<{ count: string }>(
        "SELECT COUNT(*)::int AS count FROM task_assignments WHERE shift_id IN (SELECT id FROM shifts WHERE date = $1)",
        [today]
      ),
      query<{ count: string }>("SELECT COUNT(*)::int AS count FROM equipment_units WHERE status = 'ready'"),
      query<{ count: string }>("SELECT COUNT(*)::int AS count FROM tasks"),
    ]);

    return {
      activeEmployees: Number(employees[0]?.count ?? 0),
      scheduledToday: Number(shifts[0]?.count ?? 0),
      assignedJobsToday: Number(assignments[0]?.count ?? 0),
      readyEquipment: Number(equipment[0]?.count ?? 0),
      taskCount: Number(tasks[0]?.count ?? 0),
    };
  } catch {
    return null;
  }
}

const areas = [
  {
    title: "The Office",
    description: "Use Scheduler and Workboard as the day-planning engine for labor, hours, and assignment flow.",
    href: "/scheduler",
    cta: "Open Scheduler",
  },
  {
    title: "Employee Management",
    description: "Build the roster, group crews, and keep labor data clean so schedules and reporting stay reliable.",
    href: "/employees",
    cta: "Manage Employees",
  },
  {
    title: "Technician's Shop",
    description: "Track equipment readiness, tie units to tasks, and reduce assignment conflicts before crews roll out.",
    href: "/equipment",
    cta: "View Equipment",
  },
  {
    title: "The Boardroom",
    description: "Turn schedules and assignments into reports that explain where labor and dollars are going.",
    href: "/reports",
    cta: "Open Reports",
  },
];

const workflow = [
  {
    step: "Schedule labor",
    text: "Start in the scheduler to lay out shift coverage, day-off planning, and labor availability for the week.",
    href: "/scheduler",
  },
  {
    step: "Build the workboard",
    text: "Move into the workboard to assign jobs and equipment only to employees who are actually scheduled that day.",
    href: "/workboard",
  },
  {
    step: "Tighten the system",
    text: "Use setup screens to define tasks, equipment types, and employee groups so the whole workflow stays fast.",
    href: "/settings",
  },
];

export default async function Home() {
  const stats = await getStats();

  const statCards = stats
    ? [
        { label: "Active employees", value: stats.activeEmployees },
        { label: "Scheduled today", value: stats.scheduledToday },
        { label: "Assigned jobs today", value: stats.assignedJobsToday },
        { label: "Ready equipment", value: stats.readyEquipment },
      ]
    : [
        { label: "Operations dashboard", value: "Setup needed" },
        { label: "Next step", value: "Connect database" },
        { label: "Why it matters", value: "Real counts drive trust" },
        { label: "Fallback", value: "UI still ready" },
      ];

  return (
    <div className="px-5 py-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_#07111f_0%,_rgb(var(--brand-700))_34%,_rgb(var(--brand-600))_66%,_rgb(var(--accent-500))_100%)] px-6 py-7 text-white shadow-[0_32px_80px_-48px_rgba(15,23,42,0.85)] lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_0.95fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">Command Center</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight lg:text-5xl">
              Make the app feel like one operational system, not a collection of forms.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
              The strongest operations tools organize the day around real moments: scheduling labor, assigning work,
              communicating clearly, managing equipment, and reporting the outcome. This command center is designed
              to help your app feel that way from the first click.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/scheduler" className="btn-primary rounded-full bg-white px-5 py-3 text-slate-950 hover:bg-white/90">
                Plan Today's Labor
              </Link>
              <Link href="/workboard" className="btn-secondary rounded-full border-white/15 bg-white/10 px-5 py-3 text-white hover:bg-white/15">
                Open Workboard
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {statCards.map(item => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="workboard-panel p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">Recommended Flow</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Run the day in three moves</h2>
            </div>
            {stats ? (
              <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                {stats.taskCount} tasks configured in setup
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {workflow.map((item, index) => (
              <Link
                key={item.step}
                href={item.href}
                className="group rounded-[1.35rem] border border-slate-200 bg-slate-50 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-slate-900">{item.step}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                <p className="mt-4 text-sm font-semibold text-brand-700">Open module</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="workboard-panel p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-700">What To Improve Next</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Make every screen feel coordinated</h2>
          <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
            <li className="rounded-2xl bg-slate-50 px-4 py-3">Use the theme switcher to preview different brand directions without recoding every screen.</li>
            <li className="rounded-2xl bg-slate-50 px-4 py-3">Build employees, equipment, and setup data first so scheduler and workboard feel faster and more complete.</li>
            <li className="rounded-2xl bg-slate-50 px-4 py-3">Keep the breakroom focused on what matters most at distance: who is working, what is first, and what equipment goes out.</li>
          </ul>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {areas.map(area => (
          <Link
            key={area.title}
            href={area.href}
            className="group rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-55px_rgba(15,23,42,0.5)] transition-all hover:-translate-y-0.5 hover:border-brand-300"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Operations Zone</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">{area.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">{area.description}</p>
            <p className="mt-5 text-sm font-semibold text-brand-700">{area.cta}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
