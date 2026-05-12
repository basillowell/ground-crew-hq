import type { User } from '@supabase/supabase-js';

type AuthRole = 'admin' | 'manager' | 'employee';

type HelpSettingsProps = {
  orgId: string;
  user: User;
  userRole: AuthRole | null;
};

export function HelpSettings(_: HelpSettingsProps) {
  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="text-base font-semibold">Help</h3>
        <p className="text-sm text-muted-foreground">Guidance for day-to-day setup and operations.</p>
      </div>
      <div>
        <p style={{ fontWeight: 500, fontSize: '14px' }}>Operations Assistant</p>
        <p style={{ color: '#6b7280', fontSize: '13px' }}>Coming soon</p>
      </div>
      <ul className="list-disc pl-5 text-sm text-muted-foreground">
        <li>Set up your crew and roles</li>
        <li>Create shift templates</li>
        <li>Configure weather for your property</li>
        <li>Manage equipment readiness</li>
        <li>Prepare the daily workboard</li>
      </ul>
    </div>
  );
}
