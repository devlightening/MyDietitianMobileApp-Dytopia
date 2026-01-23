import { AccessKeyScope } from '@/types/accessKey';
import { cn } from '@/lib/utils';
import { ChefHat, Calendar, Star } from 'lucide-react';

interface ScopeBadgeProps {
  scope: AccessKeyScope;
  className?: string;
}

const scopeConfig = {
  [AccessKeyScope.Recipes]: {
    label: 'Tarifler',
    icon: ChefHat,
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
  },
  [AccessKeyScope.Plans]: {
    label: 'Planlar',
    icon: Calendar,
    className: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800'
  },
  [AccessKeyScope.Full]: {
    label: 'Full Premium',
    icon: Star,
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
  }
};

export function ScopeBadge({ scope, className }: ScopeBadgeProps) {
  const config = scopeConfig[scope];
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
      config.className,
      className
    )}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
