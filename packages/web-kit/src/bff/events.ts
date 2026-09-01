import type { Actor } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { actorHeaders } from './actor-headers'
import { fetchPublic } from './public'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface EventImageView { readonly url: string; readonly altText: string }
export interface EventView {
  readonly id: string; readonly type: 'webinar' | 'conference' | 'summit'; readonly mode: 'online' | 'in_person' | 'hybrid'
  readonly title: string; readonly slug: string; readonly locale: string; readonly summary: string
  readonly timezone: string; readonly venue: string; readonly city: string; readonly registrationUrl: string
  readonly startsAt: string; readonly endsAt: string; readonly speakers: readonly string[]; readonly featured: boolean
  readonly image: EventImageView | null
}

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function eventType(value: unknown): EventView['type'] { return value === 'webinar' || value === 'conference' ? value : 'summit' }
function eventMode(value: unknown): EventView['mode'] { return value === 'online' || value === 'in_person' ? value : 'hybrid' }
function event(raw: unknown): EventView {
  const row = record(raw); const image = record(row['image']); const imageUrl = text(image['url'])
  return {
    id: text(row['id']), type: eventType(row['type']), mode: eventMode(row['mode']), title: text(row['title']), slug: text(row['slug']),
    locale: text(row['locale']), summary: text(row['summary']), timezone: text(row['timezone']), venue: text(row['venue']), city: text(row['city']),
    registrationUrl: text(row['registrationUrl']), startsAt: text(row['startsAt']), endsAt: text(row['endsAt']),
    speakers: Array.isArray(row['speakers']) ? row['speakers'].map(text).filter(Boolean) : [], featured: row['featured'] === true,
    image: imageUrl === '' ? null : { url: imageUrl, altText: text(image['altText']) },
  }
}

export async function loadEvents(locale: string): Promise<readonly EventView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return []
  const body = record(await fetchPublic(apiUrl, `/public/${locale}/events`))
  return Array.isArray(body['items']) ? body['items'].map(event) : []
}

export async function createAndPublishEvent(actor: Actor, input: unknown): Promise<{ readonly id: string }> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for event publishing')
  const headers = actorHeaders(actor.id, { 'Content-Type': 'application/json' })
  const created = await fetch(joinUrl(apiUrl, '/media/events'), { method: 'POST', headers, body: JSON.stringify(input) })
  if (!created.ok) throw await problemFromResponse(created)
  const id = text(record(await created.json())['id'])
  const published = await fetch(joinUrl(apiUrl, `/media/events/${encodeURIComponent(id)}/publish`), { method: 'POST', headers })
  if (!published.ok) throw await problemFromResponse(published)
  return { id }
}
