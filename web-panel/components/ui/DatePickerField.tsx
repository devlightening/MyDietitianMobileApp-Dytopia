'use client'

import { cn } from '@/lib/utils'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { tr } from 'date-fns/locale'
import { useEffect, useMemo, useRef, useState } from 'react'

function safeParseIsoDate(value: string) {
  try {
    if (!value) return null
    const d = parseISO(value)
    if (Number.isNaN(d.getTime())) return null
    return d
  } catch {
    return null
  }
}

const WEEKDAYS_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

export function DatePickerField({
  value,
  onChange,
  placeholder = 'gg.aa.yyyy',
  disabled = false,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const selectedDate = useMemo(() => safeParseIsoDate(value), [value])
  const [cursorMonth, setCursorMonth] = useState<Date>(() => selectedDate ?? new Date())

  useEffect(() => {
    if (selectedDate) setCursorMonth(selectedDate)
  }, [selectedDate])

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursorMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(cursorMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [cursorMonth])

  const label = selectedDate
    ? format(selectedDate, 'dd.MM.yyyy', { locale: tr })
    : ''

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 h-11 rounded-2xl border text-sm font-semibold',
          'bg-[var(--surface-glass)] text-[hsl(var(--foreground))]',
          'transition-all duration-150 outline-none',
          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && open
            ? 'border-[var(--border-emerald)] shadow-[var(--shadow-glow)]'
            : !disabled && 'border-[var(--border-default)] hover:border-[var(--border-emerald-dim)]',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={cn('truncate', label ? 'text-foreground' : 'text-muted-foreground')}>
          {label || placeholder}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--brand-emerald)]" />
      </button>

      {open && !disabled && (
        <div
          className={cn(
            'absolute left-0 right-0 z-50 mt-2 overflow-hidden',
            'rounded-3xl border border-[var(--border-emerald-dim)]',
            'bg-[var(--surface-raised)] shadow-[var(--shadow-card)]',
          )}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60">
            <button
              type="button"
              onClick={() => setCursorMonth((d) => subMonths(d, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border/60 bg-white/35 text-muted-foreground hover:bg-white/55 transition-colors"
              aria-label="Önceki ay"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="min-w-0 text-center">
              <p className="text-sm font-extrabold text-foreground">
                {format(cursorMonth, 'MMMM yyyy', { locale: tr })}
              </p>
              <button
                type="button"
                onClick={() => setCursorMonth(new Date())}
                className="mt-0.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Bugün
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCursorMonth((d) => addMonths(d, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border/60 bg-white/35 text-muted-foreground hover:bg-white/55 transition-colors"
              aria-label="Sonraki ay"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="px-4 py-3">
            <div className="grid grid-cols-7 gap-1.5 text-[11px] font-bold text-muted-foreground mb-2">
              {WEEKDAYS_TR.map((d) => (
                <div key={d} className="text-center">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {days.map((day) => {
                const muted = !isSameMonth(day, cursorMonth)
                const selected = selectedDate ? isSameDay(day, selectedDate) : false
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      onChange(format(day, 'yyyy-MM-dd'))
                      setOpen(false)
                    }}
                    className={cn(
                      'h-10 rounded-2xl border text-sm font-semibold transition-colors',
                      muted
                        ? 'border-transparent text-muted-foreground/55 hover:bg-muted/30'
                        : 'border-border/60 text-foreground hover:bg-muted/50',
                      selected ? 'bg-primary/12 border-primary/25 text-primary' : '',
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Temizle
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-border/60 bg-white/35 px-3 py-2 text-xs font-bold text-foreground hover:bg-white/55 transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

