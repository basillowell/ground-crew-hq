import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type AuthRole = 'admin' | 'manager' | 'employee';

type WorkspaceSettingsProps = {
  orgId: string;
  user: User;
  userRole: AuthRole | null;
};

type OrganizationRow = {
  id: string;
  name: string | null;
  plan: string | null;
};

export function WorkspaceSettings({ orgId }: WorkspaceSettingsProps) {
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const organizationQuery = useQuery({
    queryKey: ['settings-workspace-org', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client is not configured.');
      const { data, error } = await supabase.from('organizations').select('id, name, plan').eq('id', orgId).maybeSingle();
      if (error) throw error;
      return data as OrganizationRow | null;
    },
  });

  useEffect(() => {
    setName(organizationQuery.data?.name ?? '');
  }, [organizationQuery.data?.name]);

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    setSaveError('');
    const { error } = await supabase.from('organizations').update({ name }).eq('id', orgId);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
    await organizationQuery.refetch();
  };

  if (organizationQuery.isLoading) {
    return <div className="h-32 animate-pulse rounded-xl border bg-muted/40" />;
  }

  if (organizationQuery.error) {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm text-destructive">Unable to load workspace settings.</p>
        <Button variant="outline" size="sm" onClick={() => void organizationQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="text-base font-semibold">Workspace</h3>
        <p className="text-sm text-muted-foreground">Set your organization name and view plan details.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Organization name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Plan</span>
          <div>
            <Badge variant="secondary">{organizationQuery.data?.plan ?? 'starter'}</Badge>
          </div>
        </div>
      </div>
      {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
      <div className="flex items-center gap-3">
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Saving...' : 'Save workspace'}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved ✓</span> : null}
      </div>
    </div>
  );
}
