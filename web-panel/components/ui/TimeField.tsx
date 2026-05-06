'use client'

import { cn } from '@/lib/utils'
import { Clock } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function normalizeTime(value: string): string | null {
  const cleaned = value.trim()
  const match = cleaned.match(/^(\d{1,2})[:.](\d{1,2})$/) ?? cleaned.match(/^(\d{2})(\d{2})$/)
  if (!match) return null
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  if (hh < 0 || hh > 23) return null
  if (mm < 0 || mm > 59) return null
  return `${pad2(hh)}:${pad2(mm)}`
}

function parseTimeParts(value: string): { hour: number; minute: number } | null {
  const normalized = normalizeTime(value)
  if (!normalized) return null
  const [h, m] = normalized.split(':').map((p) => Number(p))
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return { hour: h, minute: m }
}

function buildQuickMinutes(stepMinutes: number): number[] {
  const step = Math.max(1, Math.min(30, Math.round(stepMinutes)))
  if (step <= 1) return [0, 15, 30, 45]

  const minutes: number[] = []
  for (let m = 0; m < 60; m += step) minutes.push(m)

  const set = new Set<number>([0, 15, 30, 45, ...minutes])
  return Array.from(set).sort((a, b) => a - b).slice(0, 8)
}

export function TimeField({
  value,
  onChange,
  placeholder = '08:00',
  stepMinutes = 10,
  min,
  disabled = false,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  stepMinutes?: number
  min?: string
  disabled?: boolean
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const hourListRef = useRef<HTMLDivElement | null>(null)
  const minuteListRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const [pickedHour, setPickedHour] = useState<number | null>(null)
  const [pickedMinute, setPickedMinute] = useState<number | null>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const minNormalized = useMemo(() => (min ? normalizeTime(min) : null), [min])
  const quickMinutes = useMemo(() => buildQuickMinutes(stepMinutes), [stepMinutes])
  const minParts = useMemo(() => (minNormalized ? parseTimeParts(minNormalized) : null), [minNormalized])

  const isAllowed = (candidate: string) => {
    if (!minNormalized) return true
    return candidate >= minNormalized
  }

  const isHourAllowed = (hour: number) => {
    if (!minParts) return true
    return hour >= minParts.hour
  }

  const isMinuteAllowedForHour = (hour: number, minute: number) => {
    if (!minParts) return true
    if (hour > minParts.hour) return true
    if (hour < minParts.hour) return false
    return minute >= minParts.minute
  }

  const setTime = (hour: number, minute: number) => {
    const candidate = `${pad2(hour)}:${pad2(minute)}`
    if (!isAllowed(candidate)) return false
    onChange(candidate)
    setDraft(candidate)
    return true
  }

  useEffect(() => {
    if (!open) return

    const existing = parseTimeParts(draft) ?? parseTimeParts(value)
    setPickedHour(existing?.hour ?? 8)
    setPickedMinute(existing?.minute ?? 0)

    const onOutside = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open, draft, value])

  useEffect(() => {
    if (!open) return
    const hour = pickedHour
    const minute = pickedMinute
    if (hour != null) {
      const el = hourListRef.current?.querySelector<HTMLElement>(`[data-hour="${hour}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
    if (minute != null) {
      const el = minuteListRef.current?.querySelector<HTMLElement>(`[data-minute="${minute}"]`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [open, pickedHour, pickedMinute])

  const commitIfValid = (raw: string) => {
    const normalized = normalizeTime(raw)
    if (!normalized) {
      setDraft(value)
      return
    }
    if (!isAllowed(normalized)) {
      setDraft(value)
      return
    }
    onChange(normalized)
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          inputMode="numeric"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitIfValid(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitIfValid(draft)
              setOpen(false)
              inputRef.current?.blur()
            }
            if (e.key === 'Escape') {
              setDraft(value)
              setOpen(false)
              inputRef.current?.blur()
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              const parsed = parseTimeParts(draft) ?? parseTimeParts(value)
              if (!parsed) return
              e.preventDefault()
              const delta = e.shiftKey ? 10 : 1
              const sign = e.key === 'ArrowUp' ? 1 : -1
              let total = parsed.hour * 60 + parsed.minute + sign * delta
              total = ((total % (24 * 60)) + (24 * 60)) % (24 * 60)
              const nextH = Math.floor(total / 60)
              const nextM = total % 60
              setTime(nextH, nextM)
            }
          }}
          className={cn(
            'input-sfcos h-11 pr-11 font-semibold tracking-wide tabular-nums',
            disabled ? 'opacity-60 cursor-not-allowed' : '',
          )}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return
            setOpen((v) => !v)
            window.setTimeout(() => inputRef.current?.focus(), 0)
          }}
          className={cn(
            'absolute right-1.5 top-1/2 -translate-y-1/2',
            'flex h-8 w-8 items-center justify-center rounded-xl border border-border/70',
            'bg-white/45 text-muted-foreground transition-colors hover:bg-white/60',
            disabled ? 'cursor-not-allowed' : '',
          )}
          aria-label="Saat seç"
          title="Saat seç"
        >
          <Clock className="h-4 w-4" />
        </button>
      </div>

      {open && !disabled && (
        <div
          className={cn(
            'absolute left-0 z-50 mt-2 overflow-hidden',
            'rounded-3xl border border-[var(--border-emerald-dim)]',
            'bg-[var(--surface-raised)] shadow-[var(--shadow-card)]',
            'w-[340px] max-w-[calc(100vw-2rem)]',
          )}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
              Saat
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const now = new Date()
                  setTime(now.getHours(), now.getMinutes())
                  setOpen(false)
                }}
                className="rounded-2xl border border-border/60 bg-white/35 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-white/55 transition-colors"
              >
                Şimdi
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setDraft('')
                  setPickedHour(null)
                  setPickedMinute(null)
                  setOpen(false)
                }}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Temizle
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-2.5">
            <div className="rounded-2xl border border-border/60 bg-white/25 overflow-hidden">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60">
                Saat
              </div>
              <div ref={hourListRef} className="max-h-64 overflow-y-auto py-1">
                {Array.from({ length: 24 }, (_, h) => {
                  const isSelected = pickedHour === h
                  const allowed = isHourAllowed(h)
                  return (
                    <button
                      key={h}
                      data-hour={h}
                      type="button"
                      disabled={!allowed}
                      onClick={() => {
                        if (!allowed) return
                        setPickedHour(h)
                        const mm = pickedMinute ?? parseTimeParts(draft)?.minute ?? 0
                        const nextMinute = isMinuteAllowedForHour(h, mm) ? mm : (minParts?.hour === h ? (minParts.minute ?? 0) : 0)
                        setPickedMinute(nextMinute)
                        const ok = setTime(h, nextMinute)
                        if (ok) setOpen(false)
                        window.setTimeout(() => inputRef.current?.focus(), 0)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors',
                        !allowed ? 'opacity-40 cursor-not-allowed' : '',
                        isSelected
                          ? 'text-[var(--brand-emerald)] bg-[var(--brand-primary-softer)] font-extrabold'
                          : 'text-[hsl(var(--foreground))] hover:bg-[var(--surface-overlay)]',
                      )}
                    >
                      <span className="tabular-nums">{pad2(h)}</span>
                      {isSelected && <span className="text-[10px] font-bold opacity-70">Seçili</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-white/25 overflow-hidden">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60">
                Dakika
              </div>
              <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-border/60">
                {quickMinutes.map((m) => {
                  const hh = pickedHour ?? parseTimeParts(draft)?.hour ?? 8
                  const allowed = isMinuteAllowedForHour(hh, m)
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={!allowed}
                      onClick={() => {
                        if (!allowed) return
                        const hour = pickedHour ?? parseTimeParts(draft)?.hour ?? 8
                        setPickedMinute(m)
                        const ok = setTime(hour, m)
                        if (ok) setOpen(false)
                        window.setTimeout(() => inputRef.current?.focus(), 0)
                      }}
                      className={cn(
                        'h-8 rounded-2xl border px-3 text-xs font-extrabold transition-colors',
                        !allowed ? 'opacity-40 cursor-not-allowed' : '',
                        pickedMinute === m
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border/60 bg-white/35 text-muted-foreground hover:bg-white/55',
                      )}
                    >
                      {pad2(m)}
                    </button>
                  )
                })}
              </div>
              <div ref={minuteListRef} className="max-h-64 overflow-y-auto py-1">
                {Array.from({ length: 60 }, (_, m) => {
                  const hh = pickedHour ?? parseTimeParts(draft)?.hour ?? 8
                  const allowed = isMinuteAllowedForHour(hh, m) && isAllowed(`${pad2(hh)}:${pad2(m)}`)
                  const isSelected = pickedMinute === m
                  return (
                    <button
                      key={m}
                      data-minute={m}
                      type="button"
                      disabled={!allowed}
                      onClick={() => {
                        if (!allowed) return
                        setPickedMinute(m)
                        const ok = setTime(hh, m)
                        if (ok) setOpen(false)
                        window.setTimeout(() => inputRef.current?.focus(), 0)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors',
                        !allowed ? 'opacity-40 cursor-not-allowed' : '',
                        isSelected
                          ? 'text-[var(--brand-emerald)] bg-[var(--brand-primary-softer)] font-extrabold'
                          : 'text-[hsl(var(--foreground))] hover:bg-[var(--surface-overlay)]',
                      )}
                    >
                      <span className="tabular-nums">{pad2(m)}</span>
                      {isSelected && <span className="text-[10px] font-bold opacity-70">Seçili</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
