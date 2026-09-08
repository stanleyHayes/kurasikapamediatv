import type { Actor } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { actorHeaders } from './actor-headers'
import { fetchPublic } from './public'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

/** Mirrors media.EventTypes() in the Go domain. Keep the two in step. */
export const EVENT_TYPES = ['webinar', 'conference', 'summit', 'workshop', 'cultural', 'festival', 'concert', 'screening', 'community', 'other'] as const
export type EventTypeView = typeof EVENT_TYPES[number]

export interface EventImageView { readonly url: string; readonly altText: string }
export interface EventView {
  readonly id: string; readonly type: EventTypeView; readonly mode: 'online' | 'in_person' | 'hybrid'
  readonly title: string; readonly slug: string; readonly locale: string; readonly summary: string
  readonly timezone: string; readonly venue: string; readonly city: string; readonly registrationUrl: string
  readonly startsAt: string; readonly endsAt: string; readonly speakers: readonly string[]; readonly featured: boolean
  readonly published: boolean
  /** The asset id behind `image`. An edit form needs it to preselect, and
   *  without it a save clears the picture. */
  readonly imageAssetId: string
  readonly image: EventImageView | null
}

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function eventType(value: unknown): EventTypeView { return EVENT_TYPES.find((kind) => kind === value) ?? 'other' }
function eventMode(value: unknown): EventView['mode'] { return value === 'online' || value === 'in_person' ? value : 'hybrid' }
function event(raw: unknown): EventView {
  const row = record(raw); const image = record(row['image']); const imageUrl = text(image['url'])
  return {
    id: text(row['id']), type: eventType(row['type']), mode: eventMode(row['mode']), title: text(row['title']), slug: text(row['slug']),
    locale: text(row['locale']), summary: text(row['summary']), timezone: text(row['timezone']), venue: text(row['venue']), city: text(row['city']),
    registrationUrl: text(row['registrationUrl']), startsAt: text(row['startsAt']), endsAt: text(row['endsAt']),
    speakers: Array.isArray(row['speakers']) ? row['speakers'].map(text).filter(Boolean) : [], featured: row['featured'] === true,
    published: row['published'] === true, imageAssetId: text(row['imageAssetId']),
    image: imageUrl === '' ? null : { url: imageUrl, altText: text(image['altText']) },
  }
}

export async function loadEvents(locale: string): Promise<readonly EventView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return []
  const body = record(await fetchPublic(apiUrl, `/public/${locale}/events`))
  return Array.isArray(body['items']) ? body['items'].map(event) : []
}

/** One published event by slug, or null when there is none. Public. */
export async function loadEvent(locale: string, slug: string): Promise<EventView | null> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return null
  try {
    const body = await fetchPublic(apiUrl, `/public/${locale}/events/${encodeURIComponent(slug)}`)
    const row = record(body)

    // A draft is a 404 upstream; an empty id means the shape was not an event.
    return text(row['id']) === '' ? null : event(row)
  } catch {
    // notFound() is the page's job — a missing listing is not an error here.
    return null
  }
}

function apiOrThrow(): string {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for events')

  return apiUrl
}

/**
 * Creates a DRAFT. It does not publish.
 *
 * This used to create and publish in one call, which is why events had no
 * usable draft state: an editor could not review anything before readers saw
 * it, and there was no way back. Publishing is now `publishEvent`, a separate
 * decision — the same shape articles already had.
 */
export async function createEvent(actor: Actor, input: unknown): Promise<{ readonly id: string }> {
  const response = await fetch(joinUrl(apiOrThrow(), '/media/events'), {
    method: 'POST', headers: actorHeaders(actor.id, { 'Content-Type': 'application/json' }), body: JSON.stringify(input),
  })
  if (!response.ok) throw await problemFromResponse(response)

  return { id: text(record(await response.json())['id']) }
}

async function transition(actor: Actor, id: string, action: 'publish' | 'unpublish'): Promise<void> {
  const response = await fetch(
    joinUrl(apiOrThrow(), `/media/events/${encodeURIComponent(id)}/${action}`),
    { method: 'POST', headers: actorHeaders(actor.id) },
  )
  if (!response.ok) throw await problemFromResponse(response)
}

/** Edits an existing listing. The slug is frozen once it has been published. */
export async function updateEvent(actor: Actor, id: string, input: unknown): Promise<void> {
  const response = await fetch(joinUrl(apiOrThrow(), `/media/events/${encodeURIComponent(id)}`), {
    method: 'PATCH', headers: actorHeaders(actor.id, { 'Content-Type': 'application/json' }), body: JSON.stringify(input),
  })
  if (!response.ok) throw await problemFromResponse(response)
}

/**
 * Removes a listing for good. The API refuses this while it is published, so
 * the flow is always unpublish first.
 */
export async function deleteEvent(actor: Actor, id: string): Promise<void> {
  const response = await fetch(joinUrl(apiOrThrow(), `/media/events/${encodeURIComponent(id)}`), {
    method: 'DELETE', headers: actorHeaders(actor.id),
  })
  if (!response.ok) throw await problemFromResponse(response)
}

export async function publishEvent(actor: Actor, id: string): Promise<void> { return transition(actor, id, 'publish') }
export async function unpublishEvent(actor: Actor, id: string): Promise<void> { return transition(actor, id, 'unpublish') }

/** Everything the newsroom has for a locale, drafts included. Studio only. */
export async function loadStudioEvents(actor: Actor, locale: string): Promise<readonly EventView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return []
  const response = await fetch(joinUrl(apiUrl, `/media/events?locale=${encodeURIComponent(locale)}`), {
    headers: actorHeaders(actor.id), cache: 'no-store',
  })
  if (!response.ok) throw await problemFromResponse(response)
  const body = record(await response.json())

  return Array.isArray(body['items']) ? body['items'].map(event) : []
}
