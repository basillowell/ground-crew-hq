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

type ProgramSettingsRow = {
  app_name: string | null;
  primary_color: string | null;
  default_department: string | null;
};

export function WorkspaceSettings({ orgId }: WorkspaceSettingsProps) {
  const [name, setName] = useState('');
  const [appName, setAppName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#166534');
  const [defaultDepartment, setDefaultDepartment] = useState('');
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

  const programSettingsQuery = useQuery({
    queryKey: ['settings-workspace-program-settings', orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase client is not configured.');
      const { data, error } = await supabase
        .from('program_settings')
        .select('app_name, primary_color, default_department')
        .eq('org_id', orgId)
        .single();
      if (error) throw error;
      return data as ProgramSettingsRow;
    },
  });

  useEffect(() => {
    setName(organizationQuery.data?.name ?? '');
  }, [organizationQuery.data?.name]);

  useEffect(() => {
    setAppName(programSettingsQuery.data?.app_name ?? 'Ground Crew HQ');
    setPrimaryColor(programSettingsQuery.data?.primary_color ?? '#166534');
    setDefaultDepartment(programSettingsQuery.data?.default_department ?? 'Maintenance');
  }, [programSettingsQuery.data]);

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    setSaveError('');
    const [orgUpdate, programUpdate] = await Promise.all([
      supabase.from('organizations').update({ name }).eq('id', orgId),
      supabase
        .from('program_settings')
        .update({
          app_name: appName,
          primary_color: primaryColor,
          default_department: defaultDepartment,
        })
        .eq('org_id', orgId),
    ]);
    setSaving(false);
    if (orgUpdate.error || programUpdate.error) {
      setSaveError(orgUpdate.error?.message ?? programUpdate.error?.message ?? 'Unable to save workspace settings.');
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
    await Promise.all([organizationQuery.refetch(), programSettingsQuery.refetch()]);
  };

  if (organizationQuery.isLoading || programSettingsQuery.isLoading) {
    return <div className="h-32 animate-pulse rounded-xl border bg-muted/40" />;
  }

  if (organizationQuery.error || programSettingsQuery.error) {
    const message = String(
      (organizationQuery.error as { message?: string } | null)?.message ??
        (programSettingsQuery.error as { message?: string } | null)?.message ??
        'Unknown error',
    );
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm text-destructive">Failed to load: {message}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void organizationQuery.refetch();
            void programSettingsQuery.refetch();
          }}
        >
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
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">App name</span>
          <Input value={appName} onChange={(event) => setAppName(event.target.value)} />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Primary color</span>
          <Input value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">Default department</span>
          <Input value={defaultDepartment} onChange={(event) => setDefaultDepartment(event.target.value)} />
        </label>
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
