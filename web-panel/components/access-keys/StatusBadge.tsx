import { AccessKeyStatus } from '@/types/accessKey';
import { cn } from '@/lib/utils';
import { Check, Clock, X } from 'lucide-react';

interface StatusBadgeProps {
  status: AccessKeyStatus;
  className?: string;
}

const statusConfig = {
  [AccessKeyStatus.Active]: {
    label: 'Aktif',
    icon: Check,
    className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
  },
  [AccessKeyStatus.Expired]: {
    label: 'Süresi Dolmuş',
    icon: Clock,
    className: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700'
  },
  [AccessKeyStatus.Revoked]: {
    label: 'İptal Edildi',
    icon: X,
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
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
