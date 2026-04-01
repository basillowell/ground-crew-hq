import { cn } from '@/lib/utils';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variants: Record<StatusVariant, string> = {
  success: 'bg-accent text-accent-foreground border-primary/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-info/10 text-info border-info/20',
  neutral: 'bg-muted text-muted-foreground border-border',
};

interface StatusChipProps {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}

export function StatusChip({ variant, children, className }: StatusChipProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
}
