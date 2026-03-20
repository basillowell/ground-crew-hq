"use client";
import { useEffect, useState, useCallback } from "react";
import { EquipmentUnit, EquipmentType } from "@/lib/types";
import { statusColor, statusDot } from "@/lib/utils";
import Modal from "@/components/Modal";

const STATUSES = ["ready", "issue", "maintenance", "disabled"] as const;

const STATUS_LABELS: Record<string, string> = {
  ready:       "Ready",
  issue:       "Has Issue",
  maintenance: "In Maintenance",
  disabled:    "Disabled",
};

export default function EquipmentPage() {
  const [units, setUnits]         = useState<EquipmentUnit[]>([]);
  const [types, setTypes]         = useState<EquipmentType[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Partial<EquipmentUnit>>({ status: "ready" });
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [eqRes, typesRes] = await Promise.all([
  fetch("/api/equipment"),
  fetch("/api/equipment-types"),
]);
const eqData = await eqRes.json();
setUnits(Array.isArray(eqData) ? eqData : []);
if (typesRes.ok) {
  const typesData = await typesRes.json();
  setTypes(Array.isArray(typesData) ? typesData : []);
}
      if (typesRes.ok) setTypes(await typesRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew()                     { setEditing({ unit_name: "", status: "ready" }); setSaveError(""); setModalOpen(true); }
  function openEdit(u: EquipmentUnit)    { setEditing({ ...u }); setSaveError(""); setModalOpen(true); }

  async function save() {
    if (!editing.unit_name?.trim()) { setSaveError("Unit name is required."); return; }
    setSaving(true); setSaveError("");
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? "/api/equipment-units" : `/api/equipment-units/${editing.id}`, {
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

  const filtered = filterStatus === "all" ? units : units.filter(u => u.status === filterStatus);
  const grouped  = filtered.reduce<Record<string, EquipmentUnit[]>>((acc, u) => {
    const key = (u as EquipmentUnit & { type_name?: string }).type_name ?? "Other";
    (acc[key] ??= []).push(u);
    return acc;
  }, {});

  const readyCount = units.filter(u => u.status === "ready").length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment</h1>
          <p className="page-sub">{readyCount} of {units.length} units ready</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Add Unit</button>
      </div>

      {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

      {/* Status summary chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(["all", ...STATUSES] as const).map(s => {
          const count = s === "all" ? units.length : units.filter(u => u.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterStatus === s
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {s !== "all" && <span className={`w-1.5 h-1.5 rounded-full ${statusDot(s)}`} />}
              <span className="capitalize">{s === "all" ? "All" : STATUS_LABELS[s]}</span>
              <span className={filterStatus === s ? "text-gray-300" : "text-gray-400"}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="h-3 w-24 bg-gray-100 rounded-full" />
              </div>
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center justify-between">
                  <div className="h-3 w-32 bg-gray-100 rounded-full" />
                  <div className="h-5 w-20 bg-gray-100 rounded-full" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([type, typeUnits]) => (
            <div key={type}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">{type}</h2>
              <div className="card">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="th">Unit Name</th>
                      <th className="th">Status</th>
                      <th className="th text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {typeUnits.map(unit => (
                      <tr key={unit.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="td font-medium text-gray-900">{unit.unit_name}</td>
                        <td className="td">
                          <span className={`badge gap-1.5 ${statusColor(unit.status)}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusDot(unit.status)}`} />
                            {STATUS_LABELS[unit.status] ?? unit.status}
                          </span>
                        </td>
                        <td className="td text-right">
                          <button
                            onClick={() => openEdit(unit)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-600 hover:text-brand-800 text-xs font-medium"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="card text-center py-14 text-gray-400 text-sm">No equipment units found.</div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? "Edit Unit" : "New Equipment Unit"}>
        <div className="space-y-4">
          {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{saveError}</p>}
          <div>
            <label className="label">Unit Name *</label>
            <input className="input" placeholder="e.g. Boom Lift #1" value={editing.unit_name ?? ""}
              onChange={e => setEditing(p => ({ ...p, unit_name: e.target.value }))} />
          </div>
          {!editing.id && types.length > 0 && (
            <div>
              <label className="label">Equipment Type</label>
              <select className="input" value={editing.equipment_type_id ?? ""}
                onChange={e => setEditing(p => ({ ...p, equipment_type_id: e.target.value ? parseInt(e.target.value) : undefined }))}>
                <option value="">— Select type —</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEditing(p => ({ ...p, status: s }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    editing.status === s
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-gray-200 hover:border-gray-300 text-gray-600"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${statusDot(s)}`} />
                  {STATUS_LABELS[s]}
                </button>
              ))}
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
