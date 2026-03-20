"use client";

import { useState, useEffect } from "react";
import { Employee, Group } from "@/lib/types";

interface Props {
  employee: Employee | null;
  groups: Group[];
  onClose: () => void;
  onSaved: () => void;
}

export default function EmployeeModal({ employee, groups, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    worker_type: "",
    hourly_rate: "",
    group_id: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (employee) {
      setForm({
        first_name: employee.first_name,
        last_name: employee.last_name,
        worker_type: employee.worker_type ?? "",
        hourly_rate: String(employee.hourly_rate),
        group_id: employee.group_id ? String(employee.group_id) : "",
        active: employee.active,
      });
    }
  }, [employee]);

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      ...form,
      hourly_rate: parseFloat(form.hourly_rate) || 0,
      group_id: form.group_id ? parseInt(form.group_id) : null,
    };
    const url = employee ? `/api/employees/${employee.id}` : "/api/employees";
    const method = employee ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setError("Failed to save. Please try again.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {employee ? "Edit Employee" : "Add Employee"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.first_name}
                onChange={e => set("first_name", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.last_name}
                onChange={e => set("last_name", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Worker Type</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="e.g. Foreman, Laborer, Driver"
              value={form.worker_type}
              onChange={e => set("worker_type", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hourly Rate ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.hourly_rate}
                onChange={e => set("hourly_rate", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Group</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.group_id}
                onChange={e => set("group_id", e.target.value)}
              >
                <option value="">— None —</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          </div>

          {employee && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => set("active", e.target.checked)}
                className="rounded"
              />
              Active
            </label>
          )}
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
