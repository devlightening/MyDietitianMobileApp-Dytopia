import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, interactive, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'card-sfcos',
        interactive && 'interactive-card cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}
