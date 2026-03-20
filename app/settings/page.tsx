"use client";
import { useEffect, useState, useCallback } from "react";
import { Group, TaskGroup, Task } from "@/lib/types";
import Modal from "@/components/Modal";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{title}</h2>
      <div className="card">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [groups, setGroups]         = useState<Group[]>([]);
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks]           = useState<Task[]>([]);
  const [loading, setLoading]       = useState(true);

  const [newGroup, setNewGroup]           = useState("");
  const [newTaskGroup, setNewTaskGroup]   = useState("");
  const [newTaskName, setNewTaskName]     = useState("");
  const [newTaskGroupId, setNewTaskGroupId] = useState("");

  const [modalTask, setModalTask]   = useState(false);
  const [saving, setSaving]         = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [gRes, tgRes, tRes] = await Promise.all([
      fetch("/api/groups"),
      fetch("/api/task-groups"),
      fetch("/api/tasks"),
    ]);
    setGroups(await gRes.json());
    if (tgRes.ok) setTaskGroups(await tgRes.json());
    setTasks(await tRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addGroup() {
    if (!newGroup.trim()) return;
    setSaving("group");
    await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newGroup.trim() }) });
    setNewGroup(""); setSaving(""); load();
  }

  async function addTaskGroup() {
    if (!newTaskGroup.trim()) return;
    setSaving("taskgroup");
    await fetch("/api/task-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTaskGroup.trim() }) });
    setNewTaskGroup(""); setSaving(""); load();
  }

  async function addTask() {
    if (!newTaskName.trim()) return;
    setSaving("task");
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTaskName.trim(), group_id: newTaskGroupId ? parseInt(newTaskGroupId) : null }),
    });
    setNewTaskName(""); setNewTaskGroupId(""); setSaving(""); setModalTask(false); load();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Configure groups, task categories, and reference data</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse p-5">
              <div className="h-3 w-24 bg-gray-100 rounded-full mb-4" />
              {Array.from({ length: 2 }).map((_, j) => <div key={j} className="h-8 bg-gray-100 rounded-lg mb-2" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">

          {/* Employee Groups */}
          <Section title="Employee Groups">
            <ul className="divide-y divide-gray-100">
              {groups.map(g => (
                <li key={g.id} className="px-4 py-2.5 text-sm text-gray-700">{g.name}</li>
              ))}
              {groups.length === 0 && <li className="px-4 py-3 text-sm text-gray-400 italic">No groups yet.</li>}
            </ul>
            <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
              <input className="input flex-1" placeholder="New group name…" value={newGroup}
                onChange={e => setNewGroup(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addGroup(); }} />
              <button onClick={addGroup} disabled={saving === "group" || !newGroup.trim()} className="btn-primary shrink-0">
                {saving === "group" ? "Adding…" : "Add"}
              </button>
            </div>
          </Section>

          {/* Task Groups */}
          <Section title="Task Categories">
            <ul className="divide-y divide-gray-100">
              {taskGroups.map(tg => (
                <li key={tg.id} className="px-4 py-2.5 text-sm text-gray-700">{tg.name}</li>
              ))}
              {taskGroups.length === 0 && <li className="px-4 py-3 text-sm text-gray-400 italic">No categories yet.</li>}
            </ul>
            <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
              <input className="input flex-1" placeholder="New category name…" value={newTaskGroup}
                onChange={e => setNewTaskGroup(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addTaskGroup(); }} />
              <button onClick={addTaskGroup} disabled={saving === "taskgroup" || !newTaskGroup.trim()} className="btn-primary shrink-0">
                {saving === "taskgroup" ? "Adding…" : "Add"}
              </button>
            </div>
          </Section>

          {/* Tasks */}
          <Section title="Tasks">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="th">Task Name</th>
                  <th className="th">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="td font-medium text-gray-900">{t.name}</td>
                    <td className="td text-gray-500">{t.group_name ?? "—"}</td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr><td colSpan={2} className="td text-center text-gray-400 italic py-4">No tasks yet.</td></tr>
                )}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-100">
              <button onClick={() => setModalTask(true)} className="btn-secondary w-full">+ Add Task</button>
            </div>
          </Section>
        </div>
      )}

      <Modal open={modalTask} onClose={() => setModalTask(false)} title="Add Task">
        <div className="space-y-4">
          <div>
            <label className="label">Task Name *</label>
            <input className="input" placeholder="e.g. Panel Installation" value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={newTaskGroupId} onChange={e => setNewTaskGroupId(e.target.value)}>
              <option value="">— None —</option>
              {taskGroups.map(tg => <option key={tg.id} value={tg.id}>{tg.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalTask(false)} className="btn-secondary">Cancel</button>
            <button onClick={addTask} disabled={saving === "task" || !newTaskName.trim()} className="btn-primary">
              {saving === "task" ? "Saving…" : "Add Task"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
