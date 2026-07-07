import { useMemo, useState } from 'react';
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

type CrewDraft = {
  firstName: string;
  lastName: string;
  role: string;
};

type SeedTask = {
  key: string;
  name: string;
  category: string;
  estimatedHours: number;
  checked: boolean;
};

const DEFAULT_TASKS: SeedTask[] = [
  { key: 'mow-greens', name: 'Mow Greens', category: 'Mowing', estimatedHours: 3, checked: true },
  { key: 'mow-fairways', name: 'Mow Fairways', category: 'Mowing', estimatedHours: 4, checked: true },
  { key: 'roll-greens', name: 'Roll Greens', category: 'Mowing', estimatedHours: 2, checked: true },
  { key: 'bunker-maintenance', name: 'Bunker Maintenance', category: 'Maintenance', estimatedHours: 3, checked: true },
  { key: 'irrigation-check', name: 'Irrigation Check', category: 'Irrigation', estimatedHours: 3, checked: true },
  { key: 'trim-edge', name: 'Trim & Edge', category: 'Maintenance', estimatedHours: 2, checked: true },
  { key: 'collect-balls', name: 'Collect Balls', category: 'General', estimatedHours: 3, checked: true },
];

export function OnboardingWizard({ orgId, userId, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [propertyId, setPropertyId] = useState<string>('');
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');

  const [crewDraft, setCrewDraft] = useState<CrewDraft>({
    firstName: '',
    lastName: '',
    role: 'Field Staff',
  });
  const [addedCrew, setAddedCrew] = useState<Array<{ id: string; firstName: string; lastName: string; role: string }>>([]);
  const [taskSeed, setTaskSeed] = useState<SeedTask[]>(DEFAULT_TASKS);

  const selectedTasks = useMemo(() => taskSeed.filter((task) => task.checked), [taskSeed]);

  async function savePropertyAndContinue() {
    if (!supabase || !propertyName.trim()) return;
    setSaving(true);
    const payload = {
      id: crypto.randomUUID(),
      org_id: orgId,
      name: propertyName.trim(),
      address: propertyAddress.trim() || null,
    };
    const { data, error } = await supabase.from('properties').insert(payload).select('id').single();
    setSaving(false);
    if (error) {
      toast.error('Could not save property', { description: error.message });
      return;
    }
    setPropertyId(String(data?.id ?? payload.id));
    setStep(3);
  }

  async function addCrewMember() {
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
      toast.error('Could not add crew member', { description: error.message });
      return;
    }
    setAddedCrew((current) => [
      ...current,
      {
        id: payload.id,
        firstName: payload.first_name,
        lastName: payload.last_name,
        role: payload.role,
      },
    ]);
    setCrewDraft({ firstName: '', lastName: '', role: 'Field Staff' });
  }

  async function finishSetup() {
    if (!supabase || !propertyId) return;
    setSaving(true);

    if (selectedTasks.length > 0) {
      const taskRows = selectedTasks.map((task) => ({
        id: crypto.randomUUID(),
        org_id: orgId,
        property_id: propertyId,
        name: task.name,
        category: task.category,
        status: 'active',
        estimated_hours: task.estimatedHours,
        priority: 2,
      }));
      const { error: taskError } = await supabase.from('tasks').insert(taskRows);
      if (taskError) {
        setSaving(false);
        toast.error('Could not seed task library', { description: taskError.message });
        return;
      }
    }

    const { error: onboardingError } = await supabase
      .from('organizations')
      .update({ onboarding_complete: true })
      .eq('id', orgId);

    if (onboardingError) {
      const localKey = `gcrew-onboarding-complete-${orgId}`;
      localStorage.setItem(localKey, 'true');
    }

    const fallbackKey = `gcrew-onboarding-complete-${orgId}`;
    localStorage.setItem(fallbackKey, 'true');
    setSaving(false);
    toast.success('Setup complete');
    onComplete();
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Card className="rounded-2xl border p-6 shadow-sm">
        {step === 1 ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Welcome to Ground Crew HQ</h2>
            <p className="text-sm text-muted-foreground">Let&apos;s set up your operation in 3 quick steps.</p>
            <Button onClick={() => setStep(2)}>Get Started</Button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Add Your Property</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Property Name</label>
                <Input value={propertyName} onChange={(event) => setPropertyName(event.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Address (optional)</label>
                <Input value={propertyAddress} onChange={(event) => setPropertyAddress(event.target.value)} className="mt-1" />
              </div>
            </div>
            <Button onClick={() => void savePropertyAndContinue()} disabled={saving || !propertyName.trim()}>
              {saving ? 'Saving...' : 'Next'}
            </Button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Add Your Crew</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input
                placeholder="First name"
                value={crewDraft.firstName}
                onChange={(event) => setCrewDraft((current) => ({ ...current, firstName: event.target.value }))}
              />
              <Input
                placeholder="Last name"
                value={crewDraft.lastName}
                onChange={(event) => setCrewDraft((current) => ({ ...current, lastName: event.target.value }))}
              />
              <Input
                placeholder="Role"
                value={crewDraft.role}
                onChange={(event) => setCrewDraft((current) => ({ ...current, role: event.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => void addCrewMember()}
                disabled={saving || !crewDraft.firstName.trim() || !crewDraft.lastName.trim()}
              >
                {saving ? 'Adding...' : 'Add'}
              </Button>
              <Button onClick={() => setStep(4)} disabled={addedCrew.length === 0}>
                Next
              </Button>
            </div>
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Added Crew</p>
              {addedCrew.length === 0 ? (
                <p className="text-sm text-muted-foreground">No crew members added yet.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {addedCrew.map((member) => (
                    <li key={member.id}>
                      {member.firstName} {member.lastName} — {member.role}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Seed Your Task Library</h2>
            <div className="space-y-2">
              {taskSeed.map((task) => (
                <label key={task.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={task.checked}
                    onChange={(event) =>
                      setTaskSeed((current) =>
                        current.map((item) => (item.key === task.key ? { ...item, checked: event.target.checked } : item)),
                      )
                    }
                  />
                  <span>
                    {task.name} ({task.category}, {task.estimatedHours}h)
                  </span>
                </label>
              ))}
            </div>
            <Button onClick={() => void finishSetup()} disabled={saving}>
              {saving ? 'Finishing...' : 'Finish Setup'}
            </Button>
            <p className="text-xs text-muted-foreground">Signed in as {userId ? userId.slice(0, 8) : 'current user'}.</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

