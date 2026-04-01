"use client";
import { useEffect, useState, useCallback } from "react";
import { EquipmentUnit } from "@/lib/types";
import { statusDot } from "@/lib/utils";
import Modal from "@/components/Modal";

interface WorkOrder {
  id: number;
  equipment_unit_id: number;
  unit_name?: string;
  type_name?: string;
  title: string;
  description?: string;
  status: "not_started" | "in_progress" | "completed" | "skipped";
  priority: "current" | "upcoming" | "scheduled";
  service_hours?: number;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  job_count?: number;
  jobs_done?: number;
}

interface Job {
  id: number;
  work_order_id: number;
  description: string;
  completed: boolean;
  position: number;
}

const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  in_progress:  "bg-amber-100 text-amber-700",
  completed:    "bg-emerald-100 text-emerald-700",
  skipped:      "bg-red-100 text-red-600",
};
const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress:  "In Progress",
  completed:    "Completed",
  skipped:      "Skipped",
};
const PRIORITY_SECTIONS = [
  { key: "current",   label: "Current",   color: "text-red-600"   },
  { key: "upcoming",  label: "Upcoming",  color: "text-amber-600" },
  { key: "scheduled", label: "Scheduled", color: "text-gray-500"  },
  { key: "completed", label: "Completed", color: "text-emerald-600"},
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge font-medium ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function JobProgress({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{done}/{total} jobs</span>
    </div>
  );
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equipment, setEquipment]   = useState<EquipmentUnit[]>([]);
  const [jobs, setJobs]             = useState<Record<number, Job[]>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);
  const [filterUnit, setFilterUnit] = useState("");
  const [modalOpen, setModalOpen]   = useState(false);
  const [editWO, setEditWO]         = useState<Partial<WorkOrder>>({});
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState("");
  const [newJob, setNewJob]         = useState("");
  const [addingJobTo, setAddingJobTo] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [woRes, eqRes] = await Promise.all([
        fetch("/api/work-orders"),
        fetch("/api/equipment"),
      ]);
      const woData = await woRes.json();
      setWorkOrders(Array.isArray(woData) ? woData : []);
      const eqData = await eqRes.json();
      setEquipment(Array.isArray(eqData) ? eqData : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadJobs(woId: number) {
    if (jobs[woId]) return;
    const res = await fetch(`/api/work-order-jobs?work_order_id=${woId}`);
    const data = await res.json();
    setJobs(prev => ({ ...prev, [woId]: Array.isArray(data) ? data : [] }));
  }

  async function toggleExpand(woId: number) {
    if (expandedId === woId) { setExpandedId(null); return; }
    setExpandedId(woId);
    await loadJobs(woId);
  }

  async function toggleJob(job: Job) {
    await fetch(`/api/work-order-jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !job.completed }),
    });
    setJobs(prev => ({
      ...prev,
      [job.work_order_id]: prev[job.work_order_id].map(j =>
        j.id === job.id ? { ...j, completed: !j.completed } : j
      ),
    }));
    load();
  }

  async function addJob(woId: number) {
    if (!newJob.trim()) return;
    const woJobs = jobs[woId] ?? [];
    await fetch("/api/work-order-jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ work_order_id: woId, description: newJob.trim(), position: woJobs.length }),
    });
    setNewJob(""); setAddingJobTo(null);
    setJobs(prev => ({ ...prev, [woId]: [] })); // force reload
    await loadJobs(woId);
    load();
  }

  async function updateStatus(wo: WorkOrder, status: WorkOrder["status"]) {
    await fetch(`/api/work-orders/${wo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function deleteWO(id: number) {
    if (!confirm("Delete this work order?")) return;
    await fetch(`/api/work-orders/${id}`, { method: "DELETE" });
    load();
  }

  async function save() {
    if (!editWO.equipment_unit_id) { setSaveError("Select equipment unit."); return; }
    if (!editWO.title?.trim())     { setSaveError("Title is required."); return; }
    setSaving(true); setSaveError("");
    try {
      const isNew = !editWO.id;
      const res = await fetch(isNew ? "/api/work-orders" : `/api/work-orders/${editWO.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editWO),
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error); }
      setModalOpen(false); load();
    } catch (e) { setSaveError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  const filtered = filterUnit
    ? workOrders.filter(wo => String(wo.equipment_unit_id) === filterUnit)
    : workOrders;

  const currentCount   = workOrders.filter(w => w.priority === "current" && w.status !== "completed" && w.status !== "skipped").length;
  const completedCount = workOrders.filter(w => w.status === "completed").length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Work Orders</h1>
          <p className="page-sub">{currentCount} current · {completedCount} completed</p>
        </div>
        <button onClick={() => { setEditWO({ priority: "scheduled", status: "not_started" }); setSaveError(""); setModalOpen(true); }}
          className="btn-primary">+ New Work Order</button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-5">
        <select className="input w-56" value={filterUnit} onChange={e => setFilterUnit(e.target.value)}>
          <option value="">All Equipment</option>
          {equipment.map(u => (
            <option key={u.id} value={u.id}>{(u as EquipmentUnit & {type_name?:string}).type_name} — {u.unit_name}</option>
          ))}
        </select>
        {filterUnit && (
          <button onClick={() => setFilterUnit("")} className="btn-ghost text-xs">Clear filter</button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse px-4 py-4 flex items-center gap-4">
              <div className="h-4 w-48 bg-gray-100 rounded-full" />
              <div className="h-4 w-24 bg-gray-100 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {PRIORITY_SECTIONS.map(section => {
            const sectionWOs = section.key === "completed"
              ? filtered.filter(w => w.status === "completed" || w.status === "skipped")
              : filtered.filter(w => w.priority === section.key && w.status !== "completed" && w.status !== "skipped");
            if (sectionWOs.length === 0) return null;

            return (
              <div key={section.key}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className={`text-xs font-bold uppercase tracking-widest ${section.color}`}>{section.label}</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sectionWOs.length}</span>
                </div>
                <div className="card divide-y divide-gray-100">
                  {sectionWOs.map(wo => (
                    <div key={wo.id}>
                      {/* Work order row */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleExpand(wo.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{wo.title}</span>
                            <StatusBadge status={wo.status} />
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-gray-400">
                              {wo.type_name} — {wo.unit_name}
                            </span>
                            {wo.service_hours && (
                              <span className="text-xs text-gray-400">{wo.service_hours}hr interval</span>
                            )}
                            {wo.due_date && (
                              <span className="text-xs text-gray-400">Due {wo.due_date}</span>
                            )}
                            <JobProgress done={wo.jobs_done ?? 0} total={wo.job_count ?? 0} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {wo.estimated_hours && (
                            <span className="text-xs text-gray-400 hidden sm:block">{wo.estimated_hours}h est.</span>
                          )}
                          <svg viewBox="0 0 20 20" fill="currentColor"
                            className={`w-4 h-4 text-gray-300 transition-transform ${expandedId === wo.id ? "rotate-180" : ""}`}>
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {expandedId === wo.id && (
                        <div className="bg-gray-50 border-t border-gray-100 px-4 py-4">
                          {/* Job checklist */}
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Jobs</p>
                            <div className="space-y-1.5">
                              {(jobs[wo.id] ?? []).map(job => (
                                <label key={job.id} className="flex items-center gap-2.5 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={job.completed}
                                    onChange={() => toggleJob(job)}
                                    className="w-4 h-4 rounded accent-brand-600"
                                  />
                                  <span className={`text-sm ${job.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                                    {job.description}
                                  </span>
                                </label>
                              ))}
                              {(jobs[wo.id] ?? []).length === 0 && (
                                <p className="text-xs text-gray-400 italic">No jobs added yet.</p>
                              )}
                            </div>

                            {/* Add job */}
                            {addingJobTo === wo.id ? (
                              <div className="flex gap-2 mt-2">
                                <input
                                  className="input flex-1 text-sm"
                                  placeholder="Job description…"
                                  value={newJob}
                                  autoFocus
                                  onChange={e => setNewJob(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") addJob(wo.id); if (e.key === "Escape") setAddingJobTo(null); }}
                                />
                                <button onClick={() => addJob(wo.id)} className="btn-primary text-xs px-3">Add</button>
                                <button onClick={() => setAddingJobTo(null)} className="btn-secondary text-xs px-3">Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setAddingJobTo(wo.id)}
                                className="mt-2 text-xs text-brand-600 hover:text-brand-800 font-medium">
                                + Add Job
                              </button>
                            )}
                          </div>

                          {/* Description */}
                          {wo.description && (
                            <p className="text-sm text-gray-600 mb-4 border-t border-gray-200 pt-3">{wo.description}</p>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-wrap border-t border-gray-200 pt-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Status:</p>
                            {(["not_started","in_progress","completed","skipped"] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => updateStatus(wo, s)}
                                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                                  wo.status === s
                                    ? "bg-gray-900 text-white border-gray-900"
                                    : "border-gray-200 text-gray-500 hover:border-gray-400"
                                }`}
                              >
                                {STATUS_LABELS[s]}
                              </button>
                            ))}
                            <div className="ml-auto flex gap-2">
                              <button
                                onClick={() => { setEditWO({ ...wo }); setSaveError(""); setModalOpen(true); }}
                                className="btn-ghost text-xs"
                              >Edit</button>
                              <button onClick={() => deleteWO(wo.id)} className="text-xs text-red-400 hover:text-red-600 font-medium px-2">Delete</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="card text-center py-16 text-gray-400 text-sm">
              No work orders yet. Create one to track equipment maintenance.
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editWO.id ? "Edit Work Order" : "New Work Order"}>
        <div className="space-y-4">
          {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}

          <div>
            <label className="label">Equipment Unit *</label>
            <select className="input" value={editWO.equipment_unit_id ?? ""}
              onChange={e => setEditWO(p => ({ ...p, equipment_unit_id: parseInt(e.target.value) }))}>
              <option value="">— Select unit —</option>
              {equipment.map(u => (
                <option key={u.id} value={u.id}>
                  {(u as EquipmentUnit & {type_name?:string}).type_name} — {u.unit_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Title *</label>
            <input className="input" placeholder="e.g. 250 Hour Service"
              value={editWO.title ?? ""}
              onChange={e => setEditWO(p => ({ ...p, title: e.target.value }))} />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} placeholder="Optional notes…"
              value={editWO.description ?? ""}
              onChange={e => setEditWO(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Priority</label>
              <select className="input" value={editWO.priority ?? "scheduled"}
                onChange={e => setEditWO(p => ({ ...p, priority: e.target.value as WorkOrder["priority"] }))}>
                <option value="current">Current</option>
                <option value="upcoming">Upcoming</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={editWO.status ?? "not_started"}
                onChange={e => setEditWO(p => ({ ...p, status: e.target.value as WorkOrder["status"] }))}>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Service Hours</label>
              <input className="input" type="number" placeholder="250"
                value={editWO.service_hours ?? ""}
                onChange={e => setEditWO(p => ({ ...p, service_hours: parseFloat(e.target.value) || undefined }))} />
            </div>
            <div>
              <label className="label">Est. Hours</label>
              <input className="input" type="number" step="0.5" placeholder="2.0"
                value={editWO.estimated_hours ?? ""}
                onChange={e => setEditWO(p => ({ ...p, estimated_hours: parseFloat(e.target.value) || undefined }))} />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input className="input" type="date"
                value={editWO.due_date ?? ""}
                onChange={e => setEditWO(p => ({ ...p, due_date: e.target.value || undefined }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
