"use client";

import { useState, useEffect } from "react";
import { Employee, Shift } from "@/lib/types";

interface Props {
  employee: Employee;
  date: string;
  shift?: Shift;
  onClose: () => void;
  onSaved: () => void;
}

export default function ShiftModal({ employee, date, shift, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ start_time: "07:00", end_time: "15:00", is_day_off: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (shift) {
      setForm({
        start_time: shift.start_time?.slice(0, 5) ?? "07:00",
        end_time:   shift.end_time?.slice(0, 5)   ?? "15:00",
        is_day_off: shift.is_day_off,
      });
    }
  }, [shift]);

  function set(field: string, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const body = { employee_id: employee.id, date, ...form };
    const res = await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved();
    else setError("Failed to save shift.");
  }

  async function clear() {
    if (!shift) return;
    setSaving(true);
    // Mark as day off to "clear"
    await fetch("/api/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employee.id, date, is_day_off: true }),
    });
    setSaving(false);
    onSaved();
  }

  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Edit Shift</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          {employee.first_name} {employee.last_name} · {displayDate}
        </p>

        {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_day_off}
            onChange={e => set("is_day_off", e.target.checked)}
            className="rounded"
          />
          Day Off
        </label>

        {!form.is_day_off && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.start_time}
                onChange={e => set("start_time", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={form.end_time}
                onChange={e => set("end_time", e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-2">
          {shift && (
            <button
              onClick={clear}
              disabled={saving}
              className="px-3 py-2 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Clear
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">
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
