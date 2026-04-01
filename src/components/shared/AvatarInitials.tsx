import { cn } from '@/lib/utils';

interface AvatarInitialsProps {
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-12 h-12 text-lg',
};

export function AvatarInitials({ firstName, lastName, size = 'md', className }: AvatarInitialsProps) {
  return (
    <div className={cn(
      'rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary shrink-0',
      sizes[size],
      className
    )}>
      {firstName[0]}{lastName[0]}
    </div>
  );
}
