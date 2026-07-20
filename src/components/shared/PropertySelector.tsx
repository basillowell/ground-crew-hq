import { Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrgProfile } from '@/hooks/useOrgProfile';
import { useProperties } from '@/lib/supabase-queries';
import { cn } from '@/lib/utils';

type PropertySelectorProps = {
  allowAllProperties?: boolean;
  className?: string;
  label?: string;
};

export function PropertySelector({
  allowAllProperties = true,
  className,
  label = 'Property',
}: PropertySelectorProps) {
  const { currentPropertyId, setCurrentPropertyId, orgId } = useOrgProfile();
  const { data: properties = [] } = useProperties(orgId ?? undefined);
  const selectedProperty = properties.find((property) => property.id === currentPropertyId);
  const selectedPropertyName = currentPropertyId === 'all'
    ? 'All Properties'
    : selectedProperty?.name ?? 'Select property';
  const canSwitchProperties = allowAllProperties || properties.length > 1;

  if (!orgId || properties.length === 0) return null;

  return (
    <div className={cn('min-w-[220px]', className)}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</div>
      {canSwitchProperties ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="mt-1 h-10 w-full justify-between rounded-xl border-surface-border bg-surface-card/80 px-3 text-left font-medium text-text-primary hover:bg-surface-elevated/80 hover:text-text-primary"
            >
              <span className="truncate">{selectedPropertyName}</span>
              <Building2 className="ml-2 h-4 w-4 shrink-0 text-text-muted" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Property</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allowAllProperties ? (
              <DropdownMenuItem
                onClick={() => setCurrentPropertyId('all')}
                className={currentPropertyId === 'all' ? 'bg-surface-hover font-medium text-brand' : undefined}
              >
                All Properties
              </DropdownMenuItem>
            ) : null}
            {properties.map((property) => (
              <DropdownMenuItem
                key={property.id}
                onClick={() => setCurrentPropertyId(property.id)}
                className={currentPropertyId === property.id ? 'bg-surface-hover font-medium text-brand' : undefined}
              >
                {property.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="mt-1 flex h-10 items-center rounded-xl border border-surface-border bg-surface-card/80 px-3 text-sm font-medium text-text-primary">
          <span className="truncate">{selectedPropertyName}</span>
        </div>
      )}
    </div>
  );
}
