'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EVENT_TYPES, type EventView } from '@kurasikapa/web-kit/bff/events'
import type { MediaAssetView } from '@kurasikapa/web-kit/bff/media-library'
import { EVENT_TIME_ZONES, formatInZone, isoToZonedWallClock, zonedWallClockToISO } from '@kurasikapa/web-kit/time/zoned'
import { createEventAction, deleteEventAction, publishEventAction, unpublishEventAction, updateEventAction } from '@/actions/events'

type Kind = EventView['type']; type Mode = EventView['mode']

/*
 * A blank event, so the form reads `blank.title` instead of `editing?.title ??
 * ''` twelve times over. Same defaults whether the form is creating or
 * correcting; only `editing` decides which action runs.
 */
const BLANK: EventView = {
  id: '', type: 'conference', mode: 'hybrid', title: '', slug: '', locale: '', summary: '',
  timezone: 'Africa/Accra', venue: '', city: '', registrationUrl: '', startsAt: '', endsAt: '',
  speakers: [], featured: false, published: false, imageAssetId: '', image: null,
}

/**
 * The desk: one form, one list, and which event the form is currently editing.
 *
 * `editing` lives here rather than in the form because the list is what sets
 * it. The form itself is remounted per target (`key`), so its uncontrolled
 * fields pick up fresh defaultValues instead of keeping the previous event's.
 */
export function EventManager({ locale, events, assets }: { locale: string; events: readonly EventView[]; assets: readonly MediaAssetView[] }): React.ReactElement {
  const [editing, setEditing] = useState<EventView | null>(null)
  const images = assets.filter((asset) => asset.kind === 'image' && asset.status === 'ready')
  const edit = (event: EventView): void => {
    setEditing(event)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return <div className="grid gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,.8fr)]">
    <EventForm key={editing?.id ?? 'new'} locale={locale} images={images} editing={editing} onDone={() => { setEditing(null) }}/>
    <EventList events={events} locale={locale} onEdit={edit}/>
  </div>
}

function EventForm({ locale, images, editing, onDone }: { locale: string; images: readonly MediaAssetView[]; editing: EventView | null; onDone: () => void }): React.ReactElement {
  const router = useRouter()
  const current = editing ?? BLANK
  const [kind, setKind] = useState<Kind>(current.type)
  const [mode, setMode] = useState<Mode>(current.mode)
  const [timezone, setTimezone] = useState(current.timezone === '' ? BLANK.timezone : current.timezone)
  /*
   * Seeded from the event being edited, NOT ''. Update replaces the whole
   * state, so an empty picker means no imageAssetID in the payload, which
   * silently deleted the event's picture on every save.
   */
  const [imageID, setImageID] = useState(current.imageAssetId)
  const [featured, setFeatured] = useState(current.featured)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = (data: FormData): void => { start(async () => {
    const title = value(data, 'title')
    // A published slug is frozen by the domain, so an edit sends back the one
    // it already has rather than re-deriving it from a changed title.
    const payload = {
      type: kind, mode, title, slug: editing === null ? slug(title) : editing.slug, locale,
      summary: value(data, 'summary'), timezone, venue: value(data, 'venue'), city: value(data, 'city'),
      registrationURL: value(data, 'registrationURL'),
      startsAt: wallClockToISO(value(data, 'startsAt'), timezone),
      endsAt: wallClockToISO(value(data, 'endsAt'), timezone),
      ...(imageID === '' ? {} : { imageAssetID: imageID }),
      speakers: value(data, 'speakers').split(',').map((speaker) => speaker.trim()).filter(Boolean), featured,
    }
    const result = editing === null ? await createEventAction(payload) : await updateEventAction(editing.id, payload)
    if (!result.ok) { setMessage(result.error.message); return }
    setMessage(null); onDone(); router.refresh()
  }) }

  return <section className="border border-outline-variant bg-surface-container-lowest p-6 shadow-[8px_9px_0_rgba(16,75,42,.12)]"><p className="broadcast-kicker text-primary">Events desk</p><h2 className="mt-2 font-display text-3xl font-bold">{editing === null ? 'Draft an event' : 'Edit event'}</h2><EditingBanner editing={editing} onCancel={onDone}/><form action={submit} className="mt-6 space-y-5"><Choice label="Format" items={EVENT_TYPES.map((id) => [id, TYPE_LABELS[id]] as const)} selected={kind} onSelect={(id) => { setKind(id as Kind) }}/><Choice label="Attendance" items={[['online','Online'],['in_person','In person'],['hybrid','Hybrid']]} selected={mode} onSelect={(id) => { setMode(id as Mode) }}/><Field name="title" label="Event title" placeholder="Kurasikapa Media Futures Summit" defaultValue={current.title}/><TextArea name="summary" label="Public summary" placeholder="Explain who should attend, what they will learn and why this gathering matters." defaultValue={current.summary}/><ZoneChoice selected={timezone} onSelect={setTimezone}/><div className="grid gap-4 md:grid-cols-2"><Field name="startsAt" label={`Starts (${cityOf(timezone)} local time)`} type="datetime-local" defaultValue={isoToZonedWallClock(current.startsAt, timezone)}/><Field name="endsAt" label={`Ends (${cityOf(timezone)} local time)`} type="datetime-local" defaultValue={isoToZonedWallClock(current.endsAt, timezone)}/></div>{mode !== 'online' && <div className="grid gap-4 md:grid-cols-2"><Field name="venue" label="Venue" placeholder="National Theatre" defaultValue={current.venue}/><Field name="city" label="City" placeholder="Accra" defaultValue={current.city}/></div>}<Field name="registrationURL" label="Registration link" type="url" placeholder="https://events.example.org/register" optional defaultValue={current.registrationUrl}/><Field name="speakers" label="Speakers" placeholder="Ama Mensah, Kwesi Boateng" optional defaultValue={current.speakers.join(', ')}/><ImageChoice images={images} selected={imageID} onSelect={setImageID}/><label className="flex items-start gap-3 border border-outline-variant bg-surface-container-low p-4"><input type="checkbox" checked={featured} onChange={(event) => { setFeatured(event.target.checked) }} className="mt-1 size-4 accent-primary"/><span><strong className="block text-sm">Feature this event</strong><small className="text-on-surface-variant">Use it as the lead event while it remains upcoming.</small></span></label><button disabled={pending} className="bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-wait disabled:opacity-45">{pending ? <span className="inline-flex items-center gap-2">Saving <Dots/></span> : editing === null ? 'Save draft' : 'Save changes'}</button>{message !== null && <p role="alert" className="border-l-4 border-error bg-error-container/30 p-3 text-sm">{message}</p>}</form></section>
}

function EditingBanner({ editing, onCancel }: { editing: EventView | null; onCancel: () => void }): React.ReactElement | null {
  if (editing === null) return null

  return <p className="mt-3 border-l-4 border-secondary bg-secondary-container/30 p-3 text-sm">Editing <strong>{editing.title}</strong>{editing.published ? ' — published, so its web address cannot change.' : ' — still a draft.'} <button type="button" onClick={onCancel} className="ml-1 font-bold underline">Cancel</button></p>
}

function EventList({ events, locale, onEdit }: { events: readonly EventView[]; locale: string; onEdit: (event: EventView) => void }): React.ReactElement {
  const drafts = events.filter((event) => !event.published)
  return <section className="border border-outline-variant bg-surface-container-lowest p-6 shadow-[8px_9px_0_rgba(16,75,42,.12)]"><p className="broadcast-kicker text-primary">Events desk</p><h2 className="mt-2 font-display text-3xl font-bold">All events</h2><p className="mt-2 text-sm text-on-surface-variant">{events.length === 0 ? 'Nothing yet.' : `${String(drafts.length)} draft${drafts.length === 1 ? '' : 's'} · ${String(events.length - drafts.length)} published`}</p>{events.length === 0 ? <Empty/> : <div className="mt-6 space-y-4">{events.map((event) => <EventRow key={event.id} event={event} locale={locale} onEdit={onEdit}/>)}</div>}</section>
}

function EventRow({ event, locale, onEdit }: { event: EventView; locale: string; onEdit: (event: EventView) => void }): React.ReactElement {
  const [message, setMessage] = useState<string | null>(null); const [pending, start] = useTransition(); const router = useRouter()
  const zone = event.timezone === '' ? 'UTC' : event.timezone
  const move = (next: 'publish' | 'unpublish'): void => { start(async () => {
    const result = await (next === 'publish' ? publishEventAction({ id: event.id }) : unpublishEventAction({ id: event.id }))
    setMessage(result.ok ? null : result.error.message)
    if (result.ok) router.refresh()
  }) }
  // Only offered on drafts — the API refuses to delete a published event, and
  // the confirm is because this one genuinely cannot be undone.
  const remove = (): void => {
    if (!window.confirm(`Delete “${event.title}” permanently? This cannot be undone.`)) return
    start(async () => {
      const result = await deleteEventAction({ id: event.id })
      setMessage(result.ok ? null : result.error.message)
      if (result.ok) router.refresh()
    })
  }
  return <article className={`border p-5 ${event.published ? 'border-outline-variant bg-surface-container-low' : 'border-dashed border-secondary bg-secondary-container/20'}`}>
    <div className="flex flex-wrap items-center gap-2">
      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${event.published ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>{event.published ? 'Published' : 'Draft'}</span>
      <span className="text-[10px] font-bold uppercase tracking-[.14em] text-primary-ink">{TYPE_LABELS[event.type]} · {formatInZone(event.startsAt, zone, locale)} ({cityOf(zone)})</span>
    </div>
    <h3 className="mt-2 font-display text-2xl font-bold">{event.title}</h3>
    <p className="mt-2 text-sm text-on-surface-variant">{event.summary}</p>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { onEdit(event) }} className="border border-outline px-4 py-2 text-xs font-bold hover:border-primary hover:text-primary">Edit</button>
    <button type="button" disabled={pending} onClick={() => { move(event.published ? 'unpublish' : 'publish') }} className={`px-4 py-2 text-xs font-bold disabled:cursor-wait disabled:opacity-50 ${event.published ? 'border border-outline text-on-surface hover:border-error hover:text-error' : 'bg-primary text-on-primary'}`}>{pending ? 'Working…' : event.published ? 'Unpublish' : 'Publish to calendar'}</button>
    {!event.published && <button type="button" disabled={pending} onClick={remove} className="border border-outline px-4 py-2 text-xs font-bold text-on-surface-variant hover:border-error hover:text-error disabled:cursor-wait disabled:opacity-50">Delete</button>}</div>
    {message !== null && <p role="alert" className="mt-3 text-sm text-error">{message}</p>}
  </article>
}
function ImageChoice({ images, selected, onSelect }: { images: readonly MediaAssetView[]; selected: string; onSelect: (id: string) => void }): React.ReactElement { return <fieldset><legend className="mb-3 text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">Feature image (optional)</legend>{images.length === 0 ? <p className="border-l-4 border-secondary bg-secondary-container/30 p-4 text-sm">Upload an accessible image in Media Library to add event photography.</p> : <div className="grid gap-3 sm:grid-cols-2">{images.map((image) => <button key={image.id} type="button" aria-pressed={selected === image.id} onClick={() => { onSelect(selected === image.id ? '' : image.id) }} className={`border p-3 text-left ${selected === image.id ? 'border-primary bg-primary/10 shadow-[4px_5px_0_rgba(16,75,42,.15)]' : 'border-outline-variant'}`}><strong className="block truncate text-sm">{image.filename}</strong><span className="mt-1 block line-clamp-2 text-xs text-on-surface-variant">{image.altText}</span></button>)}</div>}</fieldset> }
function Choice({ label, items, selected, onSelect }: { label: string; items: readonly (readonly [string,string])[]; selected: string; onSelect: (id: string) => void }): React.ReactElement { return <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</legend><div className="flex flex-wrap gap-2">{items.map(([id,itemLabel]) => <button key={id} type="button" aria-pressed={selected === id} onClick={() => { onSelect(id) }} className={`border px-3 py-2 text-xs font-bold ${selected === id ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant hover:border-primary'}`}>{itemLabel}</button>)}</div></fieldset> }
function Field({ name, label, placeholder = '', type = 'text', optional = false, defaultValue = '' }: { name: string; label: string; placeholder?: string; type?: string; optional?: boolean; defaultValue?: string }): React.ReactElement { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</span><input name={name} type={type} required={!optional} placeholder={placeholder} defaultValue={defaultValue} className="h-12 w-full border border-outline-variant bg-surface px-4 focus:border-primary focus:outline-none"/></label> }
function TextArea({ name, label, placeholder, defaultValue = '' }: { name: string; label: string; placeholder: string; defaultValue?: string }): React.ReactElement { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</span><textarea name={name} required rows={4} placeholder={placeholder} defaultValue={defaultValue} className="w-full border border-outline-variant bg-surface p-4 focus:border-primary focus:outline-none"/></label> }
function Empty(): React.ReactElement { return <div className="signal-grid mt-6 border border-outline-variant p-8 text-center"><span aria-hidden className="mx-auto grid size-12 animate-pulse place-items-center bg-primary text-xl text-on-primary">◇</span><h3 className="mt-4 font-display text-xl font-bold">The events desk is ready.</h3><p className="mt-2 text-sm text-on-surface-variant">Publish the first approved webinar, conference or summit to fill this calendar.</p></div> }
function Dots(): React.ReactElement { return <span aria-hidden className="inline-flex gap-1"><i className="size-1 animate-bounce rounded-full bg-current"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]"/></span> }
const TYPE_LABELS: Readonly<Record<EventView['type'], string>> = {
  webinar: 'Webinar', conference: 'Conference', summit: 'Summit', workshop: 'Workshop',
  cultural: 'Cultural', festival: 'Festival', concert: 'Concert', screening: 'Screening',
  community: 'Community', other: 'Other',
}

function value(data: FormData, name: string): string { const item = data.get(name); return typeof item === 'string' ? item : '' }
function slug(input: string): string { return input.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').trim().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') }
/* Empty passes straight through so the schema reports the missing field, rather
   than this throwing first and hiding which input was blank. */
function wallClockToISO(input: string, timezone: string): string { return input === '' ? '' : zonedWallClockToISO(input, timezone) }
function cityOf(timezone: string): string { return (timezone.split('/').pop() ?? timezone).replaceAll('_', ' ') }
function ZoneChoice({ selected, onSelect }: { selected: string; onSelect: (zone: string) => void }): React.ReactElement { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">Time zone</span><select value={selected} onChange={(event) => { onSelect(event.target.value) }} className="h-12 w-full border border-outline-variant bg-surface px-4 focus:border-primary focus:outline-none">{EVENT_TIME_ZONES.map((zone) => <option key={zone} value={zone}>{cityOf(zone)} — {zone}</option>)}</select><small className="mt-2 block text-on-surface-variant">Times below are entered as they appear on a clock in this zone. Daylight saving is applied for you.</small></label> }
