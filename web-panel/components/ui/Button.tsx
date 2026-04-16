import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'action';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', loading, className, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold leading-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          variant === 'primary' && 'bg-primary text-primary-foreground shadow-sm shadow-emerald-900/10 hover:bg-primary/90 hover:-translate-y-0.5',
          variant === 'secondary' && 'border border-border bg-secondary text-foreground hover:bg-accent',
          variant === 'action' && 'bg-action text-action-foreground shadow-sm shadow-emerald-900/10 hover:bg-action/90 hover:-translate-y-0.5',
          variant === 'danger' && 'bg-danger text-danger-foreground hover:bg-danger/90',
          variant === 'ghost' && 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
          (disabled || loading) && 'cursor-not-allowed opacity-60 hover:translate-y-0',
          className
        )}
        {...props}
      >
        {loading ? <span className="animate-pulse">...</span> : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
