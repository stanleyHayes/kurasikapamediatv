'use client'

import { useEffect, useRef, useState } from 'react'

export interface SelectOption { readonly value: string; readonly label: string; readonly description?: string }

export function BrandedSelect({ name, value, options, onChange, label, placeholder = 'Choose an option' }: { name?: string; value: string; options: readonly SelectOption[]; onChange: (value: string) => void; label: string; placeholder?: string }): React.ReactElement {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)
  useEffect(() => {
    const close = (event: PointerEvent): void => { if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => { document.removeEventListener('pointerdown', close) }
  }, [])
  return <div ref={root} className="relative"><input type="hidden" name={name} value={value}/><button type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true) } }} onClick={() => { setOpen((current) => !current) }} className="flex min-h-14 w-full items-center justify-between gap-4 border border-outline bg-surface-container-lowest px-4 text-left text-sm font-semibold text-on-surface transition-[border-color,box-shadow] hover:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"><span className={selected === undefined ? 'text-on-surface-variant' : ''}>{selected?.label ?? placeholder}</span><span aria-hidden className={`grid size-8 place-items-center border border-outline-variant bg-surface-container-low text-secondary transition-transform ${open ? 'rotate-180 border-secondary' : ''}`}>⌄</span></button>{open && <ul role="listbox" aria-label={label} className="broadcast-shadow absolute left-0 right-0 top-full z-40 mt-2 max-h-80 overflow-y-auto border-t-4 border-secondary bg-inverse-surface p-1 text-white">{options.map((option) => <li key={option.value} role="option" aria-selected={option.value === value}><button type="button" onClick={() => { onChange(option.value); setOpen(false) }} className={`grid w-full grid-cols-[1.5rem_1fr] gap-2 px-3 py-3 text-left transition-colors hover:bg-white/10 ${option.value === value ? 'bg-white/10' : ''}`}><span aria-hidden className="text-secondary">{option.value === value ? '✓' : '·'}</span><span><strong className="block text-sm">{option.label}</strong>{option.description && <small className="mt-1 block text-white/55">{option.description}</small>}</span></button></li>)}</ul>}</div>
}
