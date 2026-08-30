'use client'

import { useState } from 'react'

const BOX = 'h-11 min-w-0 flex-1 border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface outline-none focus:border-primary'

export function BrandedDateTime({ name, value, onChange, disabled, label }: { name?: string; value?: string; onChange?: (value: string) => void; disabled?: boolean; label: string }): React.ReactElement {
  const [local, setLocal] = useState(value ?? '')
  const current = value ?? local
  const [date = '', time = ''] = current.split('T')
  const update = (nextDate: string, nextTime: string): void => {
    const next = nextDate === '' && nextTime === '' ? '' : `${nextDate}T${nextTime}`
    setLocal(next); onChange?.(next)
  }
  return <fieldset disabled={disabled} className="flex min-w-0 gap-2"><legend className="sr-only">{label}</legend><input type="hidden" name={name} value={current}/><label className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-bold uppercase text-on-surface-variant">Date</span><input type="text" inputMode="numeric" placeholder="YYYY-MM-DD" pattern="\d{4}-\d{2}-\d{2}" value={date} onChange={(event) => { update(event.target.value, time) }} className={BOX}/></label><label className="w-32"><span className="mb-1 block text-[10px] font-bold uppercase text-on-surface-variant">Time</span><input type="text" inputMode="numeric" placeholder="HH:MM" pattern="\d{2}:\d{2}" value={time} onChange={(event) => { update(date, event.target.value) }} className={BOX}/></label></fieldset>
}
