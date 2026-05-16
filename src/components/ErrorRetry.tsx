import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorRetryProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorRetry({ message, onRetry }: ErrorRetryProps) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Something went wrong</p>
          <p className="mt-1 text-xs">{message}</p>
        </div>
      </div>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

