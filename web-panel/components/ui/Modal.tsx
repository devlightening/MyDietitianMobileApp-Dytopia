import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className={cn('relative max-w-full rounded-2xl border border-border/80 bg-card p-6 shadow-2xl')}
        role="dialog" aria-modal="true">
        {title && <div className="mb-4 pr-8 text-lg font-semibold text-foreground">{title}</div>}
        {children}
        <button
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}
