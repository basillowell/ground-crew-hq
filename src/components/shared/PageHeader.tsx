import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

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
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div>
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
