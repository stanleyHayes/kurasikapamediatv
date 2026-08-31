import type { Actor } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { fetchPublic } from './public'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface GalleryMediaView {
  readonly assetId: string; readonly url: string; readonly mimeType: string; readonly altText: string
  readonly caption: string; readonly credit: string; readonly captionUrl: string; readonly posterUrl: string
}
export interface GalleryView {
  readonly id: string; readonly kind: 'photo' | 'video'; readonly title: string; readonly slug: string
  readonly locale: string; readonly summary: string; readonly publishedAt: string; readonly media: readonly GalleryMediaView[]
}

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function media(raw: unknown): GalleryMediaView { const row = record(raw); return { assetId: text(row['assetId']), url: text(row['url']), mimeType: text(row['mimeType']), altText: text(row['altText']), caption: text(row['caption']), credit: text(row['credit']), captionUrl: text(row['captionUrl']), posterUrl: text(row['posterUrl']) } }
function gallery(raw: unknown): GalleryView {
  const row = record(raw); const kind = row['kind'] === 'video' ? 'video' : 'photo'
  return { id: text(row['id']), kind, title: text(row['title']), slug: text(row['slug']), locale: text(row['locale']), summary: text(row['summary']), publishedAt: text(row['publishedAt']), media: Array.isArray(row['media']) ? row['media'].map(media) : [] }
}
export async function loadGalleries(locale: string): Promise<readonly GalleryView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return []
  const body = record(await fetchPublic(apiUrl, `/public/${locale}/galleries`))
  return Array.isArray(body['items']) ? body['items'].map(gallery) : []
}
export async function createAndPublishGallery(actor: Actor, input: unknown): Promise<{ readonly id: string }> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for gallery publishing')
  const headers = { 'Content-Type': 'application/json', 'X-Kurasikapa-User': actor.id }
  const created = await fetch(joinUrl(apiUrl, '/media/galleries'), { method: 'POST', headers, body: JSON.stringify(input) })
  if (!created.ok) throw await problemFromResponse(created)
  const id = text(record(await created.json())['id'])
  const published = await fetch(joinUrl(apiUrl, `/media/galleries/${id}/publish`), { method: 'POST', headers })
  if (!published.ok) throw await problemFromResponse(published)
  return { id }
}
