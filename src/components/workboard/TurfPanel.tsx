import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/StatusChip';
import { Scissors, FlaskConical, Droplets } from 'lucide-react';

interface TurfData {
  mowPatterns: string[];
  heightOfCut: { area: string; height: string; frequency: string }[];
  chemicals: { name: string; type: string; lastApplied: string; nextDue: string }[];
}

interface TurfPanelProps {
  data: TurfData;
}

export function TurfPanel({ data }: TurfPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Scissors className="h-3.5 w-3.5 text-primary" /> Height of Cut
        </h4>
        <div className="space-y-1.5">
          {data.heightOfCut.map(h => (
            <div key={h.area} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/50">
              <span className="font-medium">{h.area}</span>
              <span className="text-primary font-mono">{h.height}</span>
              <span className="text-muted-foreground">{h.frequency}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <FlaskConical className="h-3.5 w-3.5 text-primary" /> Chemicals
        </h4>
        <div className="space-y-1.5">
          {data.chemicals.map(c => (
            <div key={c.name} className="p-1.5 rounded bg-muted/50 text-xs">
              <div className="flex justify-between">
                <span className="font-medium">{c.name}</span>
                <StatusChip variant="info">{c.type}</StatusChip>
              </div>
              <div className="text-muted-foreground mt-0.5">
                Applied: {c.lastApplied} • Next: {c.nextDue}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
          <Droplets className="h-3.5 w-3.5 text-primary" /> Mow Patterns
        </h4>
        <div className="flex flex-wrap gap-1">
          {data.mowPatterns.map(p => (
            <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
