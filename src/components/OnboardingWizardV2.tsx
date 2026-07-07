import { useMemo, useState } from 'react';
import { addDays, startOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { createClient } from '@/lib/supabase';

const supabase = createClient();

type OnboardingWizardProps = {
  orgId: string;
  userId?: string;
  onComplete: () => void;
};

type CrewDraft = { firstName: string; lastName: string; role: string };
type CrewMember = { id: string; firstName: string; lastName: string; role: string };
type TaskSeed = { key: string; name: string; category: string; estimatedHours: number; checked: boolean };

const TASKS: TaskSeed[] = [
  { key: 'mow-greens', name: 'Mow Greens', category: 'Mowing', estimatedHours: 3, checked: true },
  { key: 'mow-fairways', name: 'Mow Fairways', category: 'Mowing', estimatedHours: 4, checked: true },
  { key: 'roll-greens', name: 'Roll Greens', category: 'Mowing', estimatedHours: 2, checked: true },
  { key: 'bunker-maintenance', name: 'Bunker Maintenance', category: 'Maintenance', estimatedHours: 3, checked: true },
  { key: 'irrigation-check', name: 'Irrigation Check', category: 'Irrigation', estimatedHours: 3, checked: true },
  { key: 'trim-edge', name: 'Trim & Edge', category: 'Maintenance', estimatedHours: 2, checked: true },
  { key: 'collect-balls', name: 'Collect Balls', category: 'General', estimatedHours: 3, checked: true },
];

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

const shortNameFrom = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3) || 'GC';

function uid(prefix: string) {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}


export function OnboardingWizardV2({ orgId, userId, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [propertyId, setPropertyId] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');


  const [crewDraft, setCrewDraft] = useState<CrewDraft>({ firstName: '', lastName: '', role: 'Field Staff' });
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [tasks, setTasks] = useState<TaskSeed[]>(TASKS);
  const [scheduleState, setScheduleState] = useState<Record<string, boolean>>({});

  const progressPct = Math.round((step / 5) * 100);
  const selectedTasks = useMemo(() => tasks.filter((task) => task.checked), [tasks]);
  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);

  const updateScheduleCell = (employeeId: string, day: string, enabled: boolean) => {
    setScheduleState((current) => ({ ...current, [`${employeeId}-${day}`]: enabled }));
  };

  const getScheduleCell = (employeeId: string, day: string) => {
    const key = `${employeeId}-${day}`;
    if (key in scheduleState) return scheduleState[key];
    return true;
  };

  const saveProperty = async () => {
    if (!supabase || !propertyName.trim()) return;
    setSaving(true);
    const payload = {
      id: crypto.randomUUID(),
      org_id: orgId,
      name: propertyName.trim(),
      short_name: shortNameFrom(propertyName.trim()),
      city: propertyAddress.trim() || '',
      state: '',
      color: '#166534',
      logo_initials: 'GC',
      acreage: 0,
      status: 'active',
    };
    const { data, error } = await supabase.from('properties').insert(payload).select('id').maybeSingle();
    setSaving(false);
    if (error) {
      toast.error(`Failed to save property: ${error.message}`);
      return;
    }
    setPropertyId(String(data?.id ?? payload.id));
    setStep(3);
  };

  const addCrewMember = async () => {
    if (!supabase || !propertyId) return;
    if (!crewDraft.firstName.trim() || !crewDraft.lastName.trim()) return;
    setSaving(true);
    const payload = {
      id: crypto.randomUUID(),
      org_id: orgId,
      property_id: propertyId,
      first_name: crewDraft.firstName.trim(),
      last_name: crewDraft.lastName.trim(),
      role: crewDraft.role.trim() || 'Field Staff',
      department: 'Maintenance',
      status: 'active',
      active: true,
    };
    const { error } = await supabase.from('employees').insert(payload);
    setSaving(false);
    if (error) {
      toast.error(`Could not add crew member: ${error.message}`);
      return;
    }
    setCrew((current) => [...current, { id: payload.id, firstName: payload.first_name, lastName: payload.last_name, role: payload.role }]);
    setCrewDraft({ firstName: '', lastName: '', role: 'Field Staff' });
  };

  const seedTasks = async () => {
    if (!supabase || !propertyId) return;
    setSaving(true);
    if (selectedTasks.length > 0) {
      const rows = selectedTasks.map((task) => ({
        id: crypto.randomUUID(),
        org_id: orgId,
        property_id: propertyId,
        name: task.name,
        category: task.category,
        status: 'active',
        estimated_hours: task.estimatedHours,
        priority: 2,
      }));
      const { error } = await supabase.from('tasks').insert(rows);
      if (error) {
        setSaving(false);
        toast.error(`Could not seed tasks: ${error.message}`);
        return;
      }
    }
    setSaving(false);
    setStep(5);
  };

  const createFirstSchedule = async () => {
    if (!supabase || !propertyId || crew.length === 0) return;
    setSaving(true);
    const rows: Array<Record<string, unknown>> = [];
    crew.forEach((member) => {
      DAY_KEYS.forEach((dayKey, index) => {
        if (!getScheduleCell(member.id, dayKey)) return;
        const date = addDays(weekStart, index).toISOString().slice(0, 10);
        rows.push({
          id: crypto.randomUUID(),
          org_id: orgId,
          property_id: propertyId,
          employee_id: member.id,
          date,
          shift_start: '07:00',
          shift_end: '15:30',
          status: 'scheduled',
        });
      });
    });
    if (rows.length > 0) {
      const { error } = await supabase.from('schedule_entries').insert(rows);
      if (error) {
        setSaving(false);
        toast.error(`Could not create first schedule: ${error.message}`);
        return;
      }
    }
    try {
      await supabase.from('organizations').update({ onboarding_complete: true }).eq('id', orgId);
    } catch {
      // local fallback below handles completion state
    }
    localStorage.setItem(`gcrew-onboarding-complete-${orgId}`, 'true');
    setSaving(false);
    setStep(6);
  };

  const completeWizard = () => {
    localStorage.setItem(`gcrew-onboarding-complete-${orgId}`, 'true');
    toast.success('Setup complete');
    onComplete();
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Card className="rounded-2xl border p-6 shadow-sm">
        <div className="mb-5">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Step {Math.min(step, 5)} of 5</div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }} />
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Welcome to Ground Crew HQ</h2>
            <p className="text-sm text-muted-foreground">Let&apos;s get your operation live in 5 quick steps.</p>
            <Button onClick={() => setStep(1 + 1)}>Get Started</Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 1 — Add Your Property</h2>
            <div>
              <label className="text-xs text-muted-foreground">Property Name</label>
              <Input value={propertyName} onChange={(event) => setPropertyName(event.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Address (optional)</label>
              <Input value={propertyAddress} onChange={(event) => setPropertyAddress(event.target.value)} className="mt-1" />
            </div>
            <Button onClick={() => void saveProperty()} disabled={saving || !propertyName.trim()}>
              {saving ? 'Saving...' : 'Next'}
            </Button>
          </div>
        ) : null}


        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 2 — Add Your Crew</h2>
            <div className="grid gap-2 md:grid-cols-3">
              <Input value={crewDraft.firstName} onChange={(event) => setCrewDraft((current) => ({ ...current, firstName: event.target.value }))} placeholder="First name" />
              <Input value={crewDraft.lastName} onChange={(event) => setCrewDraft((current) => ({ ...current, lastName: event.target.value }))} placeholder="Last name" />
              <Input value={crewDraft.role} onChange={(event) => setCrewDraft((current) => ({ ...current, role: event.target.value }))} placeholder="Role" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void addCrewMember()} disabled={saving || !crewDraft.firstName.trim() || !crewDraft.lastName.trim()}>
                {saving ? 'Adding...' : 'Add'}
              </Button>
              <Button onClick={() => setStep(4)} disabled={crew.length === 0}>Next</Button>
            </div>
            <ul className="rounded-lg border p-3 text-sm">
              {crew.length === 0 ? <li className="text-muted-foreground">No crew added yet.</li> : crew.map((member) => <li key={member.id}>{member.firstName} {member.lastName} — {member.role}</li>)}
            </ul>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 3 — Seed Task Library</h2>
            <div className="space-y-2">
              {tasks.map((task) => (
                <label key={task.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={task.checked} onChange={(event) => setTasks((current) => current.map((entry) => (entry.key === task.key ? { ...entry, checked: event.target.checked } : entry)))} />
                  <span>{task.name} ({task.category}, {task.estimatedHours}h)</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => void seedTasks()} disabled={saving}>{saving ? 'Saving...' : 'Next'}</Button>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Step 4 — Create Your First Schedule</h2>
            <p className="text-sm text-muted-foreground">Default shift 7:00 AM – 3:30 PM. Uncheck any day off.</p>
            <div className="space-y-3">
              {crew.map((member) => (
                <div key={member.id} className="rounded-lg border p-3">
                  <div className="mb-2 text-sm font-medium">{member.firstName} {member.lastName}</div>
                  <div className="flex flex-wrap gap-2">
                    {DAY_KEYS.map((dayKey, index) => (
                      <label key={`${member.id}-${dayKey}`} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">
                        <input
                          type="checkbox"
                          checked={getScheduleCell(member.id, dayKey)}
                          onChange={(event) => updateScheduleCell(member.id, dayKey, event.target.checked)}
                        />
                        <span>{DAY_LABELS[index]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => void createFirstSchedule()} disabled={saving}>{saving ? 'Creating...' : 'Create Schedule'}</Button>
          </div>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-semibold">🎉 You&apos;re all set!</h2>
            <p className="text-sm text-muted-foreground">Your operation is configured and ready to go.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={completeWizard}>Open Dashboard</Button>
              <Button variant="outline" onClick={completeWizard}>Open Workboard</Button>
            </div>
            <p className="text-xs text-muted-foreground">Session: {userId ? userId.slice(0, 8) : uid('user').slice(0, 8)}</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

