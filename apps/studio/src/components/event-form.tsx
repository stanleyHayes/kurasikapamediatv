'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { EventView } from '@kurasikapa/web-kit/bff/events'
import type { MediaAssetView } from '@kurasikapa/web-kit/bff/media-library'
import { isoToZonedWallClock, zonedWallClockToISO } from '@kurasikapa/web-kit/time/zoned'
import { createEventAction, updateEventAction } from '@/actions/events'
import { Choice, Dots, Field, ImageChoice, TextArea, ZoneChoice } from './event-fields'
import {
  BLANK_EVENT, EVENT_MODE_ITEMS, EVENT_TYPE_ITEMS, cityOf, formValue, slugify,
} from './event-labels'

type Kind = EventView['type']; type Mode = EventView['mode']

/**
 * One form, on its own page, for both creating and correcting.
 *
 * `editing === null` means create. Everything else about the two is identical,
 * which is why they are one component rather than two that drift apart.
 */
export function EventForm({ locale, images, editing }: { locale: string; images: readonly MediaAssetView[]; editing: EventView | null }): React.ReactElement {
  const router = useRouter()
  const current = editing ?? BLANK_EVENT
  const [kind, setKind] = useState<Kind>(current.type)
  const [mode, setMode] = useState<Mode>(current.mode)
  const [timezone, setTimezone] = useState(current.timezone === '' ? BLANK_EVENT.timezone : current.timezone)
  /*
   * Seeded from the event, NOT ''. Update replaces the whole state, so an
   * empty picker sends no imageAssetID and silently deletes the picture.
   */
  const [imageID, setImageID] = useState(current.imageAssetId)
  const [featured, setFeatured] = useState(current.featured)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = (data: FormData): void => { start(async () => {
    const payload = payloadFrom(data, { locale, editing, kind, mode, timezone, imageID, featured })
    const result = editing === null ? await createEventAction(payload) : await updateEventAction(editing.id, payload)
    if (!result.ok) { setMessage(result.error.message); return }
    // Back to the list either way — the list is where the lifecycle lives.
    router.push(`/${locale}/events`)
    router.refresh()
  }) }

  return (
    <form action={submit} className="max-w-3xl space-y-5">
      <Choice label="Format" items={EVENT_TYPE_ITEMS} selected={kind} onSelect={(id) => { setKind(id as Kind) }}/>
      <Choice label="Attendance" items={EVENT_MODE_ITEMS} selected={mode} onSelect={(id) => { setMode(id as Mode) }}/>
      <Field name="title" label="Event title" placeholder="Kurasikapa Media Futures Summit" defaultValue={current.title}/>
      <TextArea name="summary" label="Public summary" placeholder="Explain who should attend, what they will learn and why this gathering matters." defaultValue={current.summary}/>
      <ZoneChoice selected={timezone} onSelect={setTimezone}/>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="startsAt" label={`Starts (${cityOf(timezone)} local time)`} type="datetime-local" defaultValue={isoToZonedWallClock(current.startsAt, timezone)}/>
        <Field name="endsAt" label={`Ends (${cityOf(timezone)} local time)`} type="datetime-local" defaultValue={isoToZonedWallClock(current.endsAt, timezone)}/>
      </div>
      {mode !== 'online' && <div className="grid gap-4 md:grid-cols-2">
        <Field name="venue" label="Venue" placeholder="National Theatre" defaultValue={current.venue}/>
        <Field name="city" label="City" placeholder="Accra" defaultValue={current.city}/>
      </div>}
      <Field name="registrationURL" label="Registration link" type="url" placeholder="https://events.example.org/register" optional defaultValue={current.registrationUrl}/>
      <Field name="speakers" label="Speakers" placeholder="Ama Mensah, Kwesi Boateng" optional defaultValue={current.speakers.join(', ')}/>
      <ImageChoice images={images} selected={imageID} onSelect={setImageID}/>
      <label className="flex items-start gap-3 border border-outline-variant bg-surface-container-low p-4">
        <input type="checkbox" checked={featured} onChange={(event) => { setFeatured(event.target.checked) }} className="mt-1 size-4 accent-primary"/>
        <span><strong className="block text-sm">Feature this event</strong><small className="text-on-surface-variant">Use it as the lead event while it remains upcoming.</small></span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-wait disabled:opacity-45">{pending ? <span className="inline-flex items-center gap-2">Saving <Dots/></span> : editing === null ? 'Save draft' : 'Save changes'}</button>
        <a href={`/${locale}/events`} className="border border-outline px-5 py-3 text-sm font-bold hover:border-primary hover:text-primary">Cancel</a>
      </div>
      {message !== null && <p role="alert" className="border-l-4 border-error bg-error-container/30 p-3 text-sm">{message}</p>}
    </form>
  )
}

interface Choices {
  locale: string; editing: EventView | null; kind: Kind; mode: Mode
  timezone: string; imageID: string; featured: boolean
}

function payloadFrom(data: FormData, c: Choices): Record<string, unknown> {
  const title = formValue(data, 'title')

  return {
    type: c.kind, mode: c.mode, title, locale: c.locale,
    // A published slug is frozen by the domain, so an edit sends back the one
    // it already has rather than re-deriving it from a changed title.
    slug: c.editing === null ? slugify(title) : c.editing.slug,
    summary: formValue(data, 'summary'), timezone: c.timezone,
    venue: formValue(data, 'venue'), city: formValue(data, 'city'),
    registrationURL: formValue(data, 'registrationURL'),
    startsAt: wallClockToISO(formValue(data, 'startsAt'), c.timezone),
    endsAt: wallClockToISO(formValue(data, 'endsAt'), c.timezone),
    ...(c.imageID === '' ? {} : { imageAssetID: c.imageID }),
    speakers: formValue(data, 'speakers').split(',').map((speaker) => speaker.trim()).filter(Boolean),
    featured: c.featured,
  }
}

/* Empty passes straight through so the schema reports the missing field,
   rather than this throwing first and hiding which input was blank. */
function wallClockToISO(input: string, timezone: string): string {
  return input === '' ? '' : zonedWallClockToISO(input, timezone)
}
