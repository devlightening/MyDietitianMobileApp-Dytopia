'use client';

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

type OptionItem = { label: string; value: string };

interface DropdownProps {
  options: OptionItem[] | string[];
  value?: string | null;
  placeholder?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function Dropdown({
  options,
  value,
  placeholder = 'Seçiniz...',
  onChange,
  className,
  disabled = false,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const normalized: OptionItem[] = options.map((o) =>
    typeof o === 'string' ? { label: o, value: o } : o,
  );
  const selected = normalized.find((o) => o.value === value);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 h-11 rounded-2xl border text-sm font-medium',
          'bg-[var(--surface-glass)] text-[hsl(var(--foreground))]',
          'transition-all duration-150 outline-none',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && open
            ? 'border-[var(--border-emerald)] shadow-[var(--shadow-glow)]'
            : !disabled && 'border-[var(--border-default)] hover:border-[var(--border-emerald-dim)]',
        )}
      >
        <span className={cn('truncate', selected ? 'text-foreground' : 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <svg
          className={cn(
            'w-4 h-4 shrink-0 text-[var(--brand-emerald)] transition-transform duration-200',
            open && 'rotate-180',
          )}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <ul
          className={cn(
            'absolute left-0 right-0 mt-2 z-50 overflow-hidden',
            'rounded-2xl border border-[var(--border-emerald-dim)]',
            'bg-[var(--surface-raised)] shadow-[var(--shadow-card)]',
            'py-1',
          )}
        >
          {normalized.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li
                key={opt.value}
                onClick={() => { onChange?.(opt.value); setOpen(false); }}
                className={cn(
                  'flex items-center justify-between px-4 py-2.5 text-sm cursor-pointer transition-colors duration-100',
                  isSelected
                    ? 'text-[var(--brand-emerald)] bg-[var(--brand-primary-softer)] font-semibold'
                    : 'text-[hsl(var(--foreground))] hover:bg-[var(--surface-overlay)]',
                )}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg
                    className="w-3.5 h-3.5 shrink-0"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8l3.5 3.5L13 5" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
