import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useProgramSettings } from '@/lib/supabase-queries';
import { useAuth } from '@/contexts/AuthContext';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: {
    label: string;
    onClick?: () => void;
    icon?: ReactNode;
  };
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, action, children }: PageHeaderProps) {
  const { currentUser } = useAuth();
  const programSetting = useProgramSettings(currentUser?.orgId).data ?? undefined;
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div>
          {(programSetting?.clientLabel || programSetting?.appName || programSetting?.logoUrl) ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {programSetting?.logoUrl ? (
                <img
                  src={programSetting.logoUrl}
                  alt={`${programSetting.clientLabel || programSetting.organizationName || 'Client'} logo`}
                  className="h-8 w-8 rounded-lg object-contain"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                  {(programSetting?.logoInitials || 'WF').slice(0, 2)}
                </div>
              )}
              <Badge variant="outline" className="rounded-full">
                {programSetting?.clientLabel || programSetting?.organizationName || 'Client profile'}
              </Badge>
              <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {programSetting?.appName || 'WorkForce App'}
              </span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {children}
        {action && (
          <Button size="sm" className="gap-1" onClick={action.onClick}>
            {action.icon || <Plus className="h-3.5 w-3.5" />}
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
