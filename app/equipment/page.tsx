"use client";
import { useEffect, useState, useCallback } from "react";
import { EquipmentUnit, EquipmentType } from "@/lib/types";
import { statusColor, statusDot } from "@/lib/utils";
import Modal from "@/components/Modal";

const STATUSES = ["ready", "issue", "maintenance", "disabled"] as const;

const STATUS_LABELS: Record<string, string> = {
  ready: "Ready",
  issue: "Has Issue",
  maintenance: "In Maintenance",
  disabled: "Disabled",
};

export default function EquipmentPage() {
  const [units, setUnits] = useState<EquipmentUnit[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<EquipmentUnit>>({ status: "ready" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeEditing, setTypeEditing] = useState<Partial<EquipmentType>>({});
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing({ unit_name: "", status: "ready" });
    setSaveError("");
    setModalOpen(true);
  }

  function openEdit(unit: EquipmentUnit) {
    setEditing({ ...unit });
    setSaveError("");
    setModalOpen(true);
  }

  function openNewType() {
    setTypeEditing({ name: "", short_name: "" });
    setTypeError("");
    setTypeModalOpen(true);
  }

  function openEditType(type: EquipmentType) {
    setTypeEditing({ ...type });
    setTypeError("");
    setTypeModalOpen(true);
  }

  async function save() {
    if (!editing.unit_name?.trim()) {
      setSaveError("Unit name is required.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? "/api/equipment-units" : `/api/equipment-units/${editing.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Save failed");
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveType() {
    if (!typeEditing.name?.trim()) {
      setTypeError("Type name is required.");
      return;
    }

    setTypeSaving(true);
    setTypeError("");
    try {
      const isNew = !typeEditing.id;
      const res = await fetch(isNew ? "/api/equipment-types" : `/api/equipment-types/${typeEditing.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(typeEditing),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Save failed");
      }
      setTypeModalOpen(false);
      load();
    } catch (e) {
      setTypeError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setTypeSaving(false);
    }
  }

  const filtered = filterStatus === "all" ? units : units.filter(unit => unit.status === filterStatus);
  const grouped = filtered.reduce<Record<string, EquipmentUnit[]>>((acc, unit) => {
    const key = unit.type_name ?? "Other";
    (acc[key] ??= []).push(unit);
    return acc;
  }, {});

  const readyCount = units.filter(unit => unit.status === "ready").length;

  return (
    <div className="px-5 py-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_rgb(var(--brand-700))_0%,_rgb(var(--brand-600))_38%,_rgb(var(--accent-500))_100%)] px-6 py-7 text-white shadow-[0_32px_80px_-48px_rgba(15,23,42,0.85)] lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">Equipment Command</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight lg:text-5xl">Manage categories, units, and readiness from one place.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
              Equipment only feels useful when the structure is clean. Create equipment types as categories,
              manage the actual units underneath them, and keep status current so the workboard only assigns
              what crews can actually take out.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={openNew} className="btn-primary rounded-full bg-white px-5 py-3 text-slate-950 hover:bg-white/90">
                Add Equipment Unit
              </button>
              <button onClick={openNewType} className="btn-secondary rounded-full border-white/15 bg-white/10 px-5 py-3 text-white hover:bg-white/15">
                Add Equipment Type
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Equipment types", value: types.length, tone: "text-white" },
              { label: "Units tracked", value: units.length, tone: "text-white" },
              { label: "Ready now", value: readyCount, tone: "text-white" },
              { label: "Attention needed", value: units.length - readyCount, tone: "text-white/80" },
            ].map(item => (
              <div key={item.label} className="rounded-2xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/60">{item.label}</p>
                <p className={`mt-2 text-2xl font-semibold tracking-tight ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="workboard-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">Equipment Types</p>
              <p className="mt-1 text-sm text-slate-600">These are your categories for mowers, trucks, tools, and specialty equipment.</p>
            </div>
            <button onClick={openNewType} className="btn-secondary text-xs">Add Type</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {types.map(type => (
              <button
                key={type.id}
                onClick={() => openEditType(type)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
              >
                <p className="text-sm font-semibold text-slate-900">{type.name}</p>
                <p className="mt-1 text-xs text-slate-500">{type.short_name || "No short code yet"}</p>
              </button>
            ))}
            {types.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
                No equipment types yet. Add categories like Greens Mowers, Utility Vehicles, Trucks, or Irrigation.
              </div>
            )}
          </div>
        </div>

        <div className="workboard-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">How Equipment Flows</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p className="rounded-2xl bg-slate-50 px-4 py-3">1. Create a type first so every unit has a clean category.</p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3">2. Add the unit and keep status current so dispatch knows what is ready.</p>
            <p className="rounded-2xl bg-slate-50 px-4 py-3">3. Assign those ready units on the workboard and surface them in the breakroom.</p>
          </div>
        </div>
      </section>

      <section className="mt-5 flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map(status => {
          const count = status === "all" ? units.length : units.filter(unit => unit.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === status
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {status !== "all" && <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />}
              <span className="capitalize">{status === "all" ? "All" : STATUS_LABELS[status]}</span>
              <span className={filterStatus === status ? "text-white/60" : "text-slate-400"}>{count}</span>
            </button>
          );
        })}
      </section>

      {loading ? (
        <div className="mt-5 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="border-b border-gray-100 px-4 py-3">
                <div className="h-3 w-24 rounded-full bg-gray-100" />
              </div>
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between border-b border-gray-100 px-4 py-3 last:border-0">
                  <div className="h-3 w-32 rounded-full bg-gray-100" />
                  <div className="h-5 w-20 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <section className="mt-5 space-y-5">
          {Object.entries(grouped).map(([typeName, typeUnits]) => (
            <div key={typeName}>
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{typeName}</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{typeUnits.length} units</span>
              </div>
              <div className="card overflow-hidden rounded-[1.4rem] border-slate-200/90 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.32)]">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="th">Unit Name</th>
                      <th className="th">Status</th>
                      <th className="th text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {typeUnits.map(unit => (
                      <tr key={unit.id} className="group transition-colors hover:bg-gray-50">
                        <td className="td font-medium text-gray-900">{unit.unit_name}</td>
                        <td className="td">
                          <span className={`badge gap-1.5 ${statusColor(unit.status)}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(unit.status)}`} />
                            {STATUS_LABELS[unit.status] ?? unit.status}
                          </span>
                        </td>
                        <td className="td text-right">
                          <button
                            onClick={() => openEdit(unit)}
                            className="text-xs font-medium text-brand-600 transition hover:text-brand-700"
                          >
                            Edit Unit
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
            <div className="card py-14 text-center text-sm text-gray-400">No equipment units found.</div>
          )}
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing.id ? "Edit Unit" : "New Equipment Unit"}>
        <div className="space-y-4">
          {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>}
          <div>
            <label className="label">Unit Name *</label>
            <input
              className="input"
              placeholder="e.g. Boom Lift #1"
              value={editing.unit_name ?? ""}
              onChange={e => setEditing(prev => ({ ...prev, unit_name: e.target.value }))}
            />
          </div>
          {!editing.id && types.length > 0 && (
            <div>
              <label className="label">Equipment Type</label>
              <select
                className="input"
                value={editing.equipment_type_id ?? ""}
                onChange={e => setEditing(prev => ({ ...prev, equipment_type_id: e.target.value ? parseInt(e.target.value, 10) : undefined }))}
              >
                <option value="">Select type</option>
                {types.map(type => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setEditing(prev => ({ ...prev, status }))}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    editing.status === status
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${statusDot(status)}`} />
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={typeModalOpen} onClose={() => setTypeModalOpen(false)} title={typeEditing.id ? "Edit Equipment Type" : "New Equipment Type"}>
        <div className="space-y-4">
          {typeError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{typeError}</p>}
          <div>
            <label className="label">Type Name *</label>
            <input
              className="input"
              placeholder="e.g. Greens Mowers"
              value={typeEditing.name ?? ""}
              onChange={e => setTypeEditing(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Short Code</label>
            <input
              className="input"
              placeholder="e.g. GM"
              value={typeEditing.short_name ?? ""}
              onChange={e => setTypeEditing(prev => ({ ...prev, short_name: e.target.value }))}
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Equipment types act as your categories. Create them once here, then use them when adding units and assigning equipment on the workboard.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setTypeModalOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveType} disabled={typeSaving} className="btn-primary">{typeSaving ? "Saving..." : "Save Type"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
