import { AccessKeyScope } from '@/types/accessKey';
import { cn } from '@/lib/utils';

interface ScopeSelectorProps {
  value: AccessKeyScope;
  onChange: (scope: AccessKeyScope) => void;
}

const scopeOptions = [
  {
    value: AccessKeyScope.Recipes,
    label: 'Sadece Tarifler',
    description: 'Danışan sadece tariflere erişebilir',
    icon: '🍳',
    color: 'blue'
  },
  {
    value: AccessKeyScope.Plans,
    label: 'Sadece Planlar',
    description: 'Danışan sadece beslenme planlarına erişebilir',
    icon: '📋',
    color: 'purple'
  },
  {
    value: AccessKeyScope.Full,
    label: 'Full Premium',
    description: 'Tüm premium özelliklere erişim',
    icon: '⭐',
    color: 'gold'
  }
];

export function ScopeSelector({ value, onChange }: ScopeSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-foreground">
        Erişim Kapsamı
      </label>
      <div className="grid grid-cols-1 gap-3">
        {scopeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left',
              'hover:border-primary/50 hover:bg-accent/50',
              value === option.value
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card'
            )}
          >
            <div className="flex-shrink-0 text-2xl mt-0.5">
              {option.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {option.label}
                </span>
                {value === option.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {option.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
