import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label className="text-sm font-semibold text-foreground/90">{label}</label>}
        <input
          ref={ref}
          className={cn(
            'input-sfcos h-11',
            error && 'border-danger',
            className
          )}
          {...props}
        />
        {error ? (
          <span className="text-xs text-danger mt-1">{error}</span>
        ) : (
          helperText && <span className="text-xs text-muted-foreground mt-1">{helperText}</span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
