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
          'px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background',
          variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
          variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          variant === 'action' && 'bg-action text-action-foreground hover:bg-action/90',
          variant === 'danger' && 'bg-danger text-danger-foreground hover:bg-danger/90',
          variant === 'ghost' && 'bg-transparent hover:bg-accent hover:text-accent-foreground',
          (disabled || loading) && 'opacity-60 cursor-not-allowed',
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
