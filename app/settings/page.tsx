"use client";
import { useEffect, useState, useCallback } from "react";
import { Group, TaskGroup, Task } from "@/lib/types";
import Modal from "@/components/Modal";
import BrandStudio from "@/components/BrandStudio";

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="workboard-panel p-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [newGroup, setNewGroup] = useState("");
  const [newTaskGroup, setNewTaskGroup] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskGroupId, setNewTaskGroupId] = useState("");

  const [modalTask, setModalTask] = useState(false);
  const [saving, setSaving] = useState<string>("");

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

  useEffect(() => {
    load();
  }, [load]);

  async function addGroup() {
    if (!newGroup.trim()) return;
    setSaving("group");
    await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroup.trim() }),
    });
    setNewGroup("");
    setSaving("");
    load();
  }

  async function addTaskGroup() {
    if (!newTaskGroup.trim()) return;
    setSaving("taskgroup");
    await fetch("/api/task-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTaskGroup.trim() }),
    });
    setNewTaskGroup("");
    setSaving("");
    load();
  }

  async function addTask() {
    if (!newTaskName.trim()) return;
    setSaving("task");
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTaskName.trim(), group_id: newTaskGroupId ? parseInt(newTaskGroupId, 10) : null }),
    });
    setNewTaskName("");
    setNewTaskGroupId("");
    setSaving("");
    setModalTask(false);
    load();
  }

  return (
    <div className="px-5 py-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,_#07111f_0%,_rgb(var(--brand-700))_34%,_rgb(var(--brand-600))_66%,_rgb(var(--accent-500))_100%)] px-6 py-7 text-white shadow-[0_32px_80px_-48px_rgba(15,23,42,0.85)] lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">System Setup</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight lg:text-5xl">Make the app more dynamic, branded, and admin-friendly.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 lg:text-base">
              Use this page to shape how the product looks and how the workflow behaves. This is where branding,
              employee groups, task categories, and reusable task setup should live so the system stays efficient as it grows.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Employee groups", value: groups.length },
              { label: "Task categories", value: taskGroups.length },
              { label: "Configured tasks", value: tasks.length },
              { label: "Admin control", value: "Live" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/55">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 space-y-6">
        <BrandStudio />

        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card animate-pulse p-5">
                <div className="mb-4 h-3 w-24 rounded-full bg-gray-100" />
                {Array.from({ length: 2 }).map((__, j) => (
                  <div key={j} className="mb-2 h-8 rounded-lg bg-gray-100" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
            <Section title="Employee Groups" subtitle="Create group structure for scheduling, reporting, and labor organization.">
              <ul className="divide-y divide-gray-100 rounded-2xl border border-slate-200 bg-white">
                {groups.map((group) => (
                  <li key={group.id} className="px-4 py-3 text-sm text-gray-700">{group.name}</li>
                ))}
                {groups.length === 0 && <li className="px-4 py-4 text-sm italic text-gray-400">No groups yet.</li>}
              </ul>
              <div className="mt-4 flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="New group name"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addGroup(); }}
                />
                <button onClick={addGroup} disabled={saving === "group" || !newGroup.trim()} className="btn-primary shrink-0">
                  {saving === "group" ? "Adding..." : "Add"}
                </button>
              </div>
            </Section>

            <Section title="Task Categories" subtitle="Group tasks in a way that makes workboard assignment faster and easier to scan.">
              <ul className="divide-y divide-gray-100 rounded-2xl border border-slate-200 bg-white">
                {taskGroups.map((taskGroup) => (
                  <li key={taskGroup.id} className="px-4 py-3 text-sm text-gray-700">{taskGroup.name}</li>
                ))}
                {taskGroups.length === 0 && <li className="px-4 py-4 text-sm italic text-gray-400">No categories yet.</li>}
              </ul>
              <div className="mt-4 flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="New category name"
                  value={newTaskGroup}
                  onChange={(e) => setNewTaskGroup(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTaskGroup(); }}
                />
                <button onClick={addTaskGroup} disabled={saving === "taskgroup" || !newTaskGroup.trim()} className="btn-primary shrink-0">
                  {saving === "taskgroup" ? "Adding..." : "Add"}
                </button>
              </div>
            </Section>

            <Section title="Tasks" subtitle="These tasks feed directly into the workboard and breakroom priority flow.">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="th">Task Name</th>
                      <th className="th">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="td font-medium text-gray-900">{task.name}</td>
                        <td className="td text-gray-500">{task.group_name ?? "Ungrouped"}</td>
                      </tr>
                    ))}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={2} className="td py-4 text-center italic text-gray-400">No tasks yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <button onClick={() => setModalTask(true)} className="btn-secondary w-full">+ Add Task</button>
              </div>
            </Section>
          </div>
        )}
      </div>

      <Modal open={modalTask} onClose={() => setModalTask(false)} title="Add Task">
        <div className="space-y-4">
          <div>
            <label className="label">Task Name *</label>
            <input className="input" placeholder="e.g. Panel Installation" value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={newTaskGroupId} onChange={(e) => setNewTaskGroupId(e.target.value)}>
              <option value="">None</option>
              {taskGroups.map((taskGroup) => <option key={taskGroup.id} value={taskGroup.id}>{taskGroup.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalTask(false)} className="btn-secondary">Cancel</button>
            <button onClick={addTask} disabled={saving === "task" || !newTaskName.trim()} className="btn-primary">
              {saving === "task" ? "Saving..." : "Add Task"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
