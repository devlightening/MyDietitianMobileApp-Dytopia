'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { DatePickerField } from './DatePickerField'
import { TimeField } from './TimeField'

function splitLocalDateTime(value: string) {
  if (!value) return { date: '', time: '' }
  const [date, time] = value.split('T')
  return { date: date ?? '', time: time ?? '' }
}

export function DateTimeField({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}) {
  const [datePart, setDatePart] = useState(() => splitLocalDateTime(value).date)
  const [timePart, setTimePart] = useState(() => splitLocalDateTime(value).time)

  useEffect(() => {
    const next = splitLocalDateTime(value)
    setDatePart(next.date)
    setTimePart(next.time)
  }, [value])

  const commit = (nextDate: string, nextTime: string) => {
    setDatePart(nextDate)
    setTimePart(nextTime)
    const combined = nextDate && nextTime ? `${nextDate}T${nextTime}` : ''
    onChange(combined)
  }

  return (
    <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', className)}>
      <DatePickerField
        value={datePart}
        onChange={(d) => commit(d, timePart)}
        disabled={disabled}
      />
      <TimeField
        value={timePart}
        onChange={(t) => commit(datePart, t)}
        disabled={disabled}
        placeholder="--:--"
        stepMinutes={5}
      />
    </div>
  )
}

