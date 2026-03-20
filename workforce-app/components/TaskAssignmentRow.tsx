"use client";

import { useState } from "react";
import { Task, TaskAssignment, EquipmentUnit } from "@/lib/types";

interface Props {
  assignment: TaskAssignment;
  tasks: Task[];
  equipment: EquipmentUnit[];
  onUpdate: (id: number, data: Partial<TaskAssignment>) => void;
  onDelete: (id: number) => void;
}

export default function TaskAssignmentRow({ assignment, tasks, equipment, onUpdate, onDelete }: Props) {
  const [saving, setSaving] = useState(false);

  async function update(field: string, value: string | number | null) {
    setSaving(true);
    const body: Record<string, unknown> = { [field]: value };
    await fetch(`/api/task-assignments/${assignment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onUpdate(assignment.id, { [field]: value } as Partial<TaskAssignment>);
    setSaving(false);
  }

  async function del() {
    await fetch(`/api/task-assignments/${assignment.id}`, { method: "DELETE" });
    onDelete(assignment.id);
  }

  const readyEquipment = equipment.filter(u => u.status === "ready");

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${saving ? "opacity-60" : ""}`}>
      {/* Task selector */}
      <select
        className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
        defaultValue={assignment.task_id}
        onChange={e => update("task_id", parseInt(e.target.value))}
      >
        {tasks.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>

      {/* Duration */}
      <input
        type="number"
        min="0.25"
        max="24"
        step="0.25"
        defaultValue={assignment.duration}
        className="w-16 border border-gray-200 rounded-md px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-brand-400"
        onBlur={e => update("duration", parseFloat(e.target.value))}
      />
      <span className="text-xs text-gray-400">hr</span>

      {/* Equipment */}
      <select
        className="w-32 border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
        defaultValue={assignment.equipment_unit_id ?? ""}
        onChange={e => update("equipment_unit_id", e.target.value ? parseInt(e.target.value) : null)}
      >
        <option value="">No equip.</option>
        {readyEquipment.map(u => (
          <option key={u.id} value={u.id}>{u.unit_name}</option>
        ))}
      </select>

      {/* Delete */}
      <button
        onClick={del}
        className="text-gray-300 hover:text-red-500 transition-colors text-sm leading-none px-1"
        title="Remove task"
      >
        ✕
      </button>
    </div>
  );
}
