import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  icon?: LucideIcon;
  'aria-label'?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  icon: Icon,
  'aria-label': ariaLabel,
}: ToggleSwitchProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 py-3',
        disabled && 'opacity-50'
      )}
    >
      {(Icon || label || description) && (
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {Icon && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="min-w-0">
            {label && (
              <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          checked ? 'bg-primary' : 'bg-muted',
          disabled && 'cursor-not-allowed'
        )}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out',
            checked ? 'translate-x-5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
}
