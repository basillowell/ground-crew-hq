import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type AuthRole = 'admin' | 'manager' | 'employee';

type AccessSettingsProps = {
  orgId: string;
  user: User;
  userRole: AuthRole | null;
};

export function AccessSettings({ orgId, user, userRole }: AccessSettingsProps) {
  const navigate = useNavigate();

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <h3 className="text-base font-semibold">Access</h3>
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">{user.email ?? 'User'}</p>
        <p className="text-muted-foreground">{user.email}</p>
        <p className="mt-1 text-muted-foreground">Organization: Ground Crew HQ</p>
        <div className="mt-2">
          <Badge variant="secondary">{userRole ?? 'employee'}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Org ID: {orgId}</p>
      </div>
      <Button variant="outline" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
