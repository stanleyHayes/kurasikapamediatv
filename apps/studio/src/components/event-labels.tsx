import { EVENT_TYPES, type EventView } from '@kurasikapa/web-kit/bff/events'

/*
 * Deliberately NOT a 'use client' module.
 *
 * Everything here is plain data, pure functions or a presentational component,
 * and both Server and Client Components import it. Values exported from a
 * 'use client' module become opaque client references on the server — dotting
 * into one throws "You cannot dot into a client module from a server
 * component", which is exactly how the events list crashed: it is a Server
 * Component and it read TYPE_LABELS[event.type].
 *
 * Interactive inputs live in event-fields.tsx, which IS a client module.
 */

export const TYPE_LABELS: Readonly<Record<EventView['type'], string>> = {
  webinar: 'Webinar', conference: 'Conference', summit: 'Summit', workshop: 'Workshop',
  cultural: 'Cultural', festival: 'Festival', concert: 'Concert', screening: 'Screening',
  community: 'Community', other: 'Other',
}

export const EVENT_TYPE_ITEMS = EVENT_TYPES.map((id) => [id, TYPE_LABELS[id]] as const)
export const EVENT_MODE_ITEMS = [['online', 'Online'], ['in_person', 'In person'], ['hybrid', 'Hybrid']] as const

/**
 * A blank event, so a form reads `current.title` rather than
 * `editing?.title ?? ''` a dozen times. Create and edit render identically;
 * only which action runs differs.
 */
export const BLANK_EVENT: EventView = {
  id: '', type: 'conference', mode: 'hybrid', title: '', slug: '', locale: '', summary: '',
  timezone: 'Africa/Accra', venue: '', city: '', registrationUrl: '', startsAt: '', endsAt: '',
  speakers: [], featured: false, published: false, imageAssetId: '', image: null,
}

export function cityOf(timezone: string): string {
  return (timezone.split('/').pop() ?? timezone).replaceAll('_', ' ')
}

export function slugify(input: string): string {
  return input.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').trim().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
}

export function formValue(data: FormData, name: string): string {
  const item = data.get(name)

  return typeof item === 'string' ? item : ''
}

/** Presentational only, so it renders on either side of the boundary. */
export function StatusChip({ published }: { published: boolean }): React.ReactElement {
  return <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${published ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>{published ? 'Published' : 'Draft'}</span>
}
