'use client'

import type { MediaAssetView } from '@kurasikapa/web-kit/bff/media-library'
import { EVENT_TIME_ZONES } from '@kurasikapa/web-kit/time/zoned'
import { cityOf } from './event-labels'

/*
 * The interactive inputs. Pure values and the status chip live in
 * event-labels.tsx, which has no 'use client' directive so Server Components
 * can import them — see the note there.
 */

export function Choice({ label, items, selected, onSelect }: { label: string; items: readonly (readonly [string, string])[]; selected: string; onSelect: (id: string) => void }): React.ReactElement {
  return <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</legend><div className="flex flex-wrap gap-2">{items.map(([id, itemLabel]) => <button key={id} type="button" aria-pressed={selected === id} onClick={() => { onSelect(id) }} className={`border px-3 py-2 text-xs font-bold ${selected === id ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant hover:border-primary'}`}>{itemLabel}</button>)}</div></fieldset>
}

export function Field({ name, label, placeholder = '', type = 'text', optional = false, defaultValue = '' }: { name: string; label: string; placeholder?: string; type?: string; optional?: boolean; defaultValue?: string }): React.ReactElement {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</span><input name={name} type={type} required={!optional} placeholder={placeholder} defaultValue={defaultValue} className="h-12 w-full border border-outline-variant bg-surface px-4 focus:border-primary focus:outline-none"/></label>
}

export function TextArea({ name, label, placeholder, defaultValue = '' }: { name: string; label: string; placeholder: string; defaultValue?: string }): React.ReactElement {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</span><textarea name={name} required rows={4} placeholder={placeholder} defaultValue={defaultValue} className="w-full border border-outline-variant bg-surface p-4 focus:border-primary focus:outline-none"/></label>
}

export function ZoneChoice({ selected, onSelect }: { selected: string; onSelect: (zone: string) => void }): React.ReactElement {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">Time zone</span><select value={selected} onChange={(event) => { onSelect(event.target.value) }} className="h-12 w-full border border-outline-variant bg-surface px-4 focus:border-primary focus:outline-none">{EVENT_TIME_ZONES.map((zone) => <option key={zone} value={zone}>{cityOf(zone)} — {zone}</option>)}</select><small className="mt-2 block text-on-surface-variant">Times below are entered as they appear on a clock in this zone. Daylight saving is applied for you.</small></label>
}

export function ImageChoice({ images, selected, onSelect }: { images: readonly MediaAssetView[]; selected: string; onSelect: (id: string) => void }): React.ReactElement {
  return <fieldset><legend className="mb-3 text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">Feature image (optional)</legend>{images.length === 0 ? <p className="border-l-4 border-secondary bg-secondary-container/30 p-4 text-sm">Upload an accessible image in Media Library to add event photography.</p> : <div className="grid gap-3 sm:grid-cols-2">{images.map((image) => <button key={image.id} type="button" aria-pressed={selected === image.id} onClick={() => { onSelect(selected === image.id ? '' : image.id) }} className={`border p-3 text-left ${selected === image.id ? 'border-primary bg-primary/10 shadow-[4px_5px_0_rgba(16,75,42,.15)]' : 'border-outline-variant'}`}><strong className="block truncate text-sm">{image.filename}</strong><span className="mt-1 block line-clamp-2 text-xs text-on-surface-variant">{image.altText}</span></button>)}</div>}</fieldset>
}

export function Dots(): React.ReactElement {
  return <span aria-hidden className="inline-flex gap-1"><i className="size-1 animate-bounce rounded-full bg-current"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]"/></span>
}
