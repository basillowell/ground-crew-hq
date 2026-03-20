"use client";
import { useEffect, useState, useCallback } from "react";
import { Employee, Group } from "@/lib/types";
import Modal from "@/components/Modal";

const EMPTY: Partial<Employee> = { first_name: "", last_name: "", worker_type: "", hourly_rate: 0, active: true };

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[140, 100, 80, 80, 70, 60].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3.5 bg-gray-100 rounded-full" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groups, setGroups]       = useState<Group[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Partial<Employee>>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState("");
  const [filter, setFilter]       = useState<"all" | "active" | "inactive">("active");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [empRes, grpRes] = await Promise.all([fetch("/api/employees"), fetch("/api/groups")]);
      if (!empRes.ok) throw new Error("Failed to load employees");
      setEmployees(await empRes.json());
      setGroups(await grpRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew()          { setEditing({ ...EMPTY }); setSaveError(""); setModalOpen(true); }
  function openEdit(e: Employee) { setEditing({ ...e }); setSaveError(""); setModalOpen(true); }

  async function save() {
    if (!editing.first_name?.trim() || !editing.last_name?.trim()) {
      setSaveError("First and last name are required."); return;
    }
    setSaving(true); setSaveError("");
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? "/api/employees" : `/api/employees/${editing.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (!res.ok) { const b = await res.json(); throw new Error(b.error ?? "Save failed"); }
      setModalOpen(false); load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !emp.active }),
    });
    load();
  }

  const visible = employees.filter(e =>
    filter === "all" ? true : filter === "active" ? e.active : !e.active
  );
  const activeCount = employees.filter(e => e.active).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-sub">{activeCount} active · {employees.length - activeCount} inactive</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Add Employee</button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {(["active", "inactive", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Name", "Type", "Rate / hr", "Group", "Status", ""].map(h => (
                <th key={h} className="th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : visible.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="td font-medium text-gray-900">{emp.first_name} {emp.last_name}</td>
                  <td className="td text-gray-500">{emp.worker_type || "—"}</td>
                  <td className="td font-mono">${Number(emp.hourly_rate).toFixed(2)}</td>
                  <td className="td text-gray-500">{emp.group_name || "—"}</td>
                  <td className="td">
                    <span className={`badge ${emp.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                      {emp.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="td text-right">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3 justify-end">
                      <button onClick={() => openEdit(emp)} className="text-brand-600 hover:text-brand-800 font-medium text-xs">Edit</button>
                      <button onClick={() => toggleActive(emp)} className="text-gray-400 hover:text-gray-700 text-xs">
                        {emp.active ? "Deactivate" : "Activate"}
                      </button>
                    </span>
                  </td>
                </tr>
              ))
            }
            {!loading && visible.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">No employees found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? "Edit Employee" : "New Employee"}>
        <div className="space-y-4">
          {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First Name *</label>
              <input className="input" value={editing.first_name ?? ""} onChange={e => setEditing(p => ({ ...p, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className="input" value={editing.last_name ?? ""} onChange={e => setEditing(p => ({ ...p, last_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Worker Type</label>
            <input className="input" placeholder="e.g. Technician, Supervisor" value={editing.worker_type ?? ""} onChange={e => setEditing(p => ({ ...p, worker_type: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Hourly Rate ($)</label>
              <input className="input" type="number" min="0" step="0.01" value={editing.hourly_rate ?? 0} onChange={e => setEditing(p => ({ ...p, hourly_rate: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Group</label>
              <select className="input" value={editing.group_id ?? ""} onChange={e => setEditing(p => ({ ...p, group_id: e.target.value ? parseInt(e.target.value) : undefined }))}>
                <option value="">— None —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          {editing.id && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" className="rounded accent-brand-600" checked={editing.active ?? true} onChange={e => setEditing(p => ({ ...p, active: e.target.checked }))} />
              Active
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
