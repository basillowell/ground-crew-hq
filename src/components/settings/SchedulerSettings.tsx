import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AuthRole = 'admin' | 'manager' | 'employee';

type SchedulerSettingsProps = {
  orgId: string;
  user: User;
  userRole: AuthRole | null;
};

type SchedulerSettingsRow = {
  id: string;
  property_id: string | null;
  operational_day_start: string | null;
  operational_day_end: string | null;
  operational_days: string[] | null;
  min_shift_hours: number | null;
  max_shift_hours: number | null;
  overtime_threshold_hours: number | null;
};

type ShiftTemplateRow = {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  days: string[] | null;
  active: boolean | null;
};

type PropertyRow = {
  id: string;
  name: string;
};

const DAY_OPTIONS = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' },
] as const;

export function SchedulerSettings({ orgId }: SchedulerSettingsProps) {
  const [settings, setSettings] = useState<SchedulerSettingsRow | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [saved, setSaved] = useState(false);
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    start_time: '05:00',
    end_time: '13:30',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
    active: true,
  });
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplateRow | null>(null);

  const propertiesQuery = useQuery({
    queryKey: ['settings-scheduler-properties', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client is not configured.');
      const { data, error } = await supabase.from('properties').select('id, name').eq('org_id', orgId).order('name');
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
  });

  const schedulerSettingsQuery = useQuery({
    queryKey: ['settings-scheduler-row', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client is not configured.');
      const { data, error } = await supabase
        .from('scheduler_settings')
        .select('id, property_id, operational_day_start, operational_day_end, operational_days, min_shift_hours, max_shift_hours, overtime_threshold_hours')
        .eq('org_id', orgId)
        .maybeSingle();
      if (error) throw error;
      return (data as SchedulerSettingsRow | null) ?? null;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ['settings-shift-templates', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client is not configured.');
      const { data, error } = await supabase
        .from('shift_templates')
        .select('id, name, start_time, end_time, days, active')
        .eq('org_id', orgId)
        .order('name');
      if (error) throw error;
      return (data ?? []) as ShiftTemplateRow[];
    },
  });

  useEffect(() => {
    const existing = schedulerSettingsQuery.data;
    if (existing) {
      setSettings(existing);
      return;
    }
    if (!schedulerSettingsQuery.isLoading && propertiesQuery.data?.length) {
      setSettings({
        id: '',
        property_id: propertiesQuery.data[0].id,
        operational_day_start: '05:00',
        operational_day_end: '18:00',
        operational_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
        min_shift_hours: 4,
        max_shift_hours: 10,
        overtime_threshold_hours: 40,
      });
    }
  }, [propertiesQuery.data, schedulerSettingsQuery.data, schedulerSettingsQuery.isLoading]);

  const loading = propertiesQuery.isLoading || schedulerSettingsQuery.isLoading || templatesQuery.isLoading;
  const anyError = propertiesQuery.error || schedulerSettingsQuery.error || templatesQuery.error;

  const saveSchedulerSettings = async () => {
    if (!supabase || !settings) return;
    setSavingSettings(true);
    setSettingsError('');
    const payload = {
      org_id: orgId,
      property_id: settings.property_id,
      operational_day_start: settings.operational_day_start,
      operational_day_end: settings.operational_day_end,
      operational_days: settings.operational_days ?? [],
      min_shift_hours: settings.min_shift_hours,
      max_shift_hours: settings.max_shift_hours,
      overtime_threshold_hours: settings.overtime_threshold_hours,
    };
    const query = settings.id
      ? supabase.from('scheduler_settings').update(payload).eq('id', settings.id).eq('org_id', orgId)
      : supabase.from('scheduler_settings').insert(payload);
    const { error } = await query;
    setSavingSettings(false);
    if (error) {
      setSettingsError(error.message);
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
    await schedulerSettingsQuery.refetch();
  };

  const toggleDays = (days: string[], dayKey: string) => {
    if (days.includes(dayKey)) return days.filter((day) => day !== dayKey);
    return [...days, dayKey];
  };

  const addTemplate = async () => {
    if (!supabase || !newTemplate.name.trim()) return;
    const { error } = await supabase.from('shift_templates').insert({
      org_id: orgId,
      name: newTemplate.name.trim(),
      start_time: newTemplate.start_time,
      end_time: newTemplate.end_time,
      days: newTemplate.days,
      active: newTemplate.active,
    });
    if (error) {
      setSettingsError(error.message);
      return;
    }
    setNewTemplate({
      name: '',
      start_time: '05:00',
      end_time: '13:30',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      active: true,
    });
    await templatesQuery.refetch();
  };

  const startEdit = (template: ShiftTemplateRow) => {
    setOpenTemplateId(template.id);
    setEditingTemplate({
      ...template,
      days: template.days ?? [],
    });
  };

  const saveTemplateEdit = async () => {
    if (!supabase || !editingTemplate) return;
    const { error } = await supabase
      .from('shift_templates')
      .update({
        name: editingTemplate.name,
        start_time: editingTemplate.start_time,
        end_time: editingTemplate.end_time,
        days: editingTemplate.days ?? [],
        active: editingTemplate.active ?? true,
      })
      .eq('id', editingTemplate.id)
      .eq('org_id', orgId);
    if (error) {
      setSettingsError(error.message);
      return;
    }
    setOpenTemplateId(null);
    setEditingTemplate(null);
    await templatesQuery.refetch();
  };

  const deleteTemplate = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from('shift_templates').delete().eq('id', id).eq('org_id', orgId);
    if (error) {
      setSettingsError(error.message);
      return;
    }
    await templatesQuery.refetch();
  };

  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />;
  }

  if (anyError) {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm text-destructive">Unable to load scheduler settings.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void propertiesQuery.refetch();
            void schedulerSettingsQuery.refetch();
            void templatesQuery.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border p-4">
        <div>
          <h3 className="text-base font-semibold">Operational Day</h3>
          <p className="text-sm text-muted-foreground">Define your property's standard operating window.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Property</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={settings?.property_id ?? ''}
              onChange={(event) => setSettings((current) => (current ? { ...current, property_id: event.target.value } : current))}
            >
              {(propertiesQuery.data ?? []).map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Operations start</span>
            <Input
              type="time"
              value={settings?.operational_day_start ?? '05:00'}
              onChange={(event) => setSettings((current) => (current ? { ...current, operational_day_start: event.target.value } : current))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Operations end</span>
            <Input
              type="time"
              value={settings?.operational_day_end ?? '18:00'}
              onChange={(event) => setSettings((current) => (current ? { ...current, operational_day_end: event.target.value } : current))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Min shift hours</span>
            <Input
              type="number"
              min={1}
              max={16}
              value={settings?.min_shift_hours ?? 4}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, min_shift_hours: Number(event.target.value) } : current,
                )
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Max shift hours</span>
            <Input
              type="number"
              min={1}
              max={16}
              value={settings?.max_shift_hours ?? 10}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, max_shift_hours: Number(event.target.value) } : current,
                )
              }
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Overtime threshold (hours/week)</span>
            <Input
              type="number"
              min={1}
              max={80}
              value={settings?.overtime_threshold_hours ?? 40}
              onChange={(event) =>
                setSettings((current) =>
                  current ? { ...current, overtime_threshold_hours: Number(event.target.value) } : current,
                )
              }
            />
          </label>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Active days</span>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((day) => {
              const selected = (settings?.operational_days ?? []).includes(day.key);
              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() =>
                    setSettings((current) =>
                      current
                        ? {
                            ...current,
                            operational_days: toggleDays(current.operational_days ?? [], day.key),
                          }
                        : current,
                    )
                  }
                  className={`h-9 w-9 rounded-md border text-sm ${selected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-input'}`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>
        {settingsError ? <p className="text-sm text-destructive">{settingsError}</p> : null}
        <div className="flex items-center gap-3">
          <Button onClick={() => void saveSchedulerSettings()} disabled={savingSettings}>
            {savingSettings ? 'Saving...' : 'Save operational day'}
          </Button>
          {saved ? <span className="text-sm text-emerald-700">Saved ✓</span> : null}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border p-4">
        <div>
          <h3 className="text-base font-semibold">Shift Templates</h3>
          <p className="text-sm text-muted-foreground">Templates pre-fill shifts in your scheduler.</p>
        </div>
        <div className="space-y-3">
          {templates.length ? (
            templates.map((template) => {
              const editDraft = openTemplateId === template.id ? editingTemplate : null;
              return (
                <div key={template.id} className="rounded-lg border p-3">
                  <button type="button" className="w-full text-left" onClick={() => startEdit(template)}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{template.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {template.start_time ?? '--'} - {template.end_time ?? '--'}
                        </p>
                      </div>
                      <span className={`text-xs ${template.active ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                        {template.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </button>
                  {editDraft ? (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input
                          value={editDraft.name}
                          onChange={(event) => setEditingTemplate((current) => (current ? { ...current, name: event.target.value } : current))}
                          placeholder="Template name"
                        />
                        <Input
                          type="time"
                          value={editDraft.start_time ?? '05:00'}
                          onChange={(event) =>
                            setEditingTemplate((current) => (current ? { ...current, start_time: event.target.value } : current))
                          }
                        />
                        <Input
                          type="time"
                          value={editDraft.end_time ?? '13:30'}
                          onChange={(event) =>
                            setEditingTemplate((current) => (current ? { ...current, end_time: event.target.value } : current))
                          }
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {DAY_OPTIONS.map((day) => {
                          const selected = (editDraft.days ?? []).includes(day.key);
                          return (
                            <button
                              key={`${template.id}-${day.key}`}
                              type="button"
                              onClick={() =>
                                setEditingTemplate((current) =>
                                  current
                                    ? {
                                        ...current,
                                        days: toggleDays(current.days ?? [], day.key),
                                      }
                                    : current,
                                )
                              }
                              className={`h-8 w-8 rounded-md border text-xs ${selected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-input'}`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => void saveTemplateEdit()}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setOpenTemplateId(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => void deleteTemplate(template.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(template.days ?? []).map((day) => (
                        <span key={`${template.id}-${day}`} className="rounded-full border px-2 py-0.5 text-xs">
                          {day}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No shift templates yet.</p>
          )}
        </div>

        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <p className="text-sm font-medium">Add template</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={newTemplate.name}
              onChange={(event) => setNewTemplate((current) => ({ ...current, name: event.target.value }))}
              placeholder="Template name"
            />
            <Input
              type="time"
              value={newTemplate.start_time}
              onChange={(event) => setNewTemplate((current) => ({ ...current, start_time: event.target.value }))}
            />
            <Input
              type="time"
              value={newTemplate.end_time}
              onChange={(event) => setNewTemplate((current) => ({ ...current, end_time: event.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {DAY_OPTIONS.map((day) => {
              const selected = newTemplate.days.includes(day.key);
              return (
                <button
                  key={`new-${day.key}`}
                  type="button"
                  onClick={() =>
                    setNewTemplate((current) => ({
                      ...current,
                      days: toggleDays(current.days, day.key),
                    }))
                  }
                  className={`h-8 w-8 rounded-md border text-xs ${selected ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-input'}`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          <Button onClick={() => void addTemplate()} className="w-fit">
            Save shift template
          </Button>
        </div>
      </div>
    </div>
  );
}
