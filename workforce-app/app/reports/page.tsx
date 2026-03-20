"use client";
import { useState, useCallback } from "react";
import { formatDate, currencyFmt } from "@/lib/utils";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

type DollarsRow  = { employee_id: number; full_name: string; hourly_rate: number; total_hours: number; total_cost: number };
type TaskRow     = { task_group: string; task_name: string; total_hours: number; occurrences: number };
type DollarsData = { rows: DollarsRow[]; totals: { total_hours: number; total_cost: number }; start: string; end: string };

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function quickRange(key: string): { start: string; end: string } {
  const now = new Date();
  if (key === "this-week")  return { start: formatDate(startOfWeek(now, { weekStartsOn: 1 })), end: formatDate(endOfWeek(now, { weekStartsOn: 1 })) };
  if (key === "this-month") return { start: formatDate(startOfMonth(now)), end: formatDate(endOfMonth(now)) };
  if (key === "last-week")  {
    const lw = new Date(now); lw.setDate(lw.getDate() - 7);
    return { start: formatDate(startOfWeek(lw, { weekStartsOn: 1 })), end: formatDate(endOfWeek(lw, { weekStartsOn: 1 })) };
  }
  return { start: formatDate(startOfWeek(now, { weekStartsOn: 1 })), end: formatDate(endOfWeek(now, { weekStartsOn: 1 })) };
}

export default function ReportsPage() {
  const [range, setRange]           = useState(() => quickRange("this-week"));
  const [tab, setTab]               = useState<"dollars" | "tasks">("dollars");
  const [dollarsData, setDollarsData] = useState<DollarsData | null>(null);
  const [tasksData, setTasksData]   = useState<TaskRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [ran, setRan]               = useState(false);

  const runReport = useCallback(async () => {
    setLoading(true); setError(""); setRan(true);
    try {
      const qs = `start=${range.start}&end=${range.end}`;
      if (tab === "dollars") {
        const res = await fetch(`/api/reports/dollars-hours?${qs}`);
        if (!res.ok) throw new Error("Report failed");
        setDollarsData(await res.json());
      } else {
        const res = await fetch(`/api/reports/task-totals?${qs}`);
        if (!res.ok) throw new Error("Report failed");
        setTasksData(await res.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed");
    } finally {
      setLoading(false);
    }
  }, [range, tab]);

  const taskGrouped = tasksData.reduce<Record<string, TaskRow[]>>((acc, r) => {
    (acc[r.task_group] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Analyze labor costs and task distribution</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card px-5 py-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Quick ranges */}
          <div>
            <label className="label">Quick Range</label>
            <div className="flex gap-1.5">
              {[["this-week","This Week"], ["last-week","Last Week"], ["this-month","This Month"]].map(([k, l]) => (
                <button key={k} onClick={() => setRange(quickRange(k))}
                  className="px-2.5 py-1.5 text-xs rounded-md border border-gray-200 hover:border-brand-400 hover:text-brand-600 transition-colors">
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Start</label>
            <input type="date" className="input w-38" value={range.start}
              onChange={e => setRange(p => ({ ...p, start: e.target.value }))} />
          </div>
          <div>
            <label className="label">End</label>
            <input type="date" className="input w-38" value={range.end}
              onChange={e => setRange(p => ({ ...p, end: e.target.value }))} />
          </div>
          {/* Tab toggle */}
          <div>
            <label className="label">Report</label>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["dollars", "tasks"] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}>
                  {t === "dollars" ? "Dollars & Hours" : "Task Totals"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={runReport} disabled={loading} className="btn-primary self-end">
            {loading ? "Running…" : "Run Report"}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

      {/* Dollars & Hours */}
      {tab === "dollars" && dollarsData && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <StatCard label="Total Hours" value={`${Number(dollarsData.totals.total_hours).toFixed(1)}h`} />
            <StatCard label="Total Labor Cost" value={currencyFmt(Number(dollarsData.totals.total_cost))} />
            <StatCard label="Employees" value={String(dollarsData.rows.filter(r => r.total_hours > 0).length)}
              sub={`${dollarsData.rows.length} total active`} />
          </div>
          <div className="card">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Employee", "Rate / hr", "Hours", "Cost", "% of Total"].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dollarsData.rows.map(r => {
                  const pct = dollarsData.totals.total_cost > 0
                    ? (r.total_cost / dollarsData.totals.total_cost) * 100 : 0;
                  return (
                    <tr key={r.employee_id} className="hover:bg-gray-50">
                      <td className="td font-medium text-gray-900">{r.full_name}</td>
                      <td className="td font-mono text-gray-500">{currencyFmt(Number(r.hourly_rate))}</td>
                      <td className="td text-gray-700">{Number(r.total_hours).toFixed(1)}h</td>
                      <td className="td font-semibold text-gray-900">{currencyFmt(Number(r.total_cost))}</td>
                      <td className="td">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-24">
                            <div className="h-full bg-brand-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="td font-bold text-gray-900" colSpan={2}>Total</td>
                  <td className="td font-bold text-gray-900">{Number(dollarsData.totals.total_hours).toFixed(1)}h</td>
                  <td className="td font-bold text-gray-900">{currencyFmt(Number(dollarsData.totals.total_cost))}</td>
                  <td className="td" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Task Totals */}
      {tab === "tasks" && tasksData.length > 0 && (
        <div className="space-y-5">
          {Object.entries(taskGrouped).map(([group, rows]) => {
            const groupHrs = rows.reduce((s, r) => s + r.total_hours, 0);
            return (
              <div key={group}>
                <div className="flex items-baseline gap-2 mb-2">
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{group}</h2>
                  <span className="text-xs text-gray-400">{groupHrs.toFixed(1)}h total</span>
                </div>
                <div className="card">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="th">Task</th>
                        <th className="th">Total Hours</th>
                        <th className="th">Occurrences</th>
                        <th className="th">Avg / Occurrence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="td font-medium text-gray-900">{r.task_name}</td>
                          <td className="td text-brand-700 font-semibold">{Number(r.total_hours).toFixed(1)}h</td>
                          <td className="td text-gray-500">{r.occurrences}×</td>
                          <td className="td text-gray-400 font-mono text-xs">
                            {(r.total_hours / r.occurrences).toFixed(1)}h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {ran && !loading && tab === "dollars" && !dollarsData && (
        <div className="card text-center py-14 text-gray-400 text-sm">No data for the selected range.</div>
      )}
      {ran && !loading && tab === "tasks" && tasksData.length === 0 && (
        <div className="card text-center py-14 text-gray-400 text-sm">No task data for the selected range.</div>
      )}
      {!ran && (
        <div className="card text-center py-16 text-gray-400 text-sm">
          Select a date range and click <strong>Run Report</strong> to see results.
        </div>
      )}
    </div>
  );
}
