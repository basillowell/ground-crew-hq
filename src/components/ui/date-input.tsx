'use client';

import * as React from 'react';
import { CalendarDays } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export type DateInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'>;

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className, disabled, ...props }, forwardedRef) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const setInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
          return;
        }
        if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const openPicker = React.useCallback(() => {
      const input = inputRef.current;
      if (!input) return;
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
      input.focus();
    }, []);

    return (
      <div className="relative flex w-full items-center">
        <Input ref={setInputRef} type="date" className={cn(className, 'pr-10')} disabled={disabled} {...props} />
        <button
          type="button"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
          onClick={openPicker}
          disabled={disabled}
          aria-label="Open date picker"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
    );
  },
);
DateInput.displayName = 'DateInput';

export { DateInput };