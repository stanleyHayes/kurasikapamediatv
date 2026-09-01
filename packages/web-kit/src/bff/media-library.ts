import type { Actor } from '@kurasikapa/domain'
import type { ArticleHeroView } from '../read-model/article-view'
import { env } from '../composition/env'
import { actorHeaders } from './actor-headers'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface MediaAssetView {
  readonly id: string; readonly kind: string; readonly filename: string; readonly mimeType: string
  readonly locale: string; readonly altText: string; readonly caption: string; readonly status: string
  readonly secureUrl: string; readonly bytes: number; readonly width: number; readonly height: number
  readonly durationSeconds: number; readonly failureReason: string
}
export interface MediaUploadTicket {
  readonly url: string; readonly apiKey: string; readonly signature: string; readonly publicID: string
  readonly resourceType: string; readonly folder: string; readonly timestamp: number
}
export interface CreateMediaUploadResult { readonly asset: MediaAssetView; readonly upload: MediaUploadTicket }

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function number(value: unknown): number { return typeof value === 'number' ? value : 0 }
function asset(raw: unknown): MediaAssetView {
  const row = record(raw)
  return { id: text(row['id']), kind: text(row['kind']), filename: text(row['filename']), mimeType: text(row['mimeType']), locale: text(row['locale']), altText: text(row['altText']), caption: text(row['caption']), status: text(row['status']), secureUrl: text(row['secureUrl']), bytes: number(row['bytes']), width: number(row['width']), height: number(row['height']), durationSeconds: number(row['durationSeconds']), failureReason: text(row['failureReason']) }
}
function ticket(raw: unknown): MediaUploadTicket {
  const row = record(raw)
  return { url: text(row['url']), apiKey: text(row['apiKey']), signature: text(row['signature']), publicID: text(row['publicId']), resourceType: text(row['resourceType']), folder: text(row['folder']), timestamp: number(row['timestamp']) }
}
async function api(actor: Actor, path: string, init: RequestInit): Promise<unknown> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for the production media library')
  const headers = new Headers(actorHeaders(actor.id, { 'Content-Type': 'application/json' }))
  for (const [key, value] of new Headers(init.headers)) headers.set(key, value)
  const response = await fetch(joinUrl(apiUrl, path), { ...init, headers })
  if (!response.ok) throw await problemFromResponse(response)
  return response.json() as Promise<unknown>
}
export async function loadMediaAssets(actor: Actor, locale: string): Promise<readonly MediaAssetView[]> {
  const raw = record(await api(actor, `/media/assets?locale=${encodeURIComponent(locale)}&limit=60`, { method: 'GET' }))
  return Array.isArray(raw['items']) ? raw['items'].map(asset) : []
}
export async function createMediaUpload(actor: Actor, input: unknown): Promise<CreateMediaUploadResult> {
  const raw = record(await api(actor, '/media/assets/uploads', { method: 'POST', body: JSON.stringify(input) }))
  return { asset: asset(raw['asset']), upload: ticket(raw['upload']) }
}
export async function completeMediaUpload(actor: Actor, id: string, input: unknown): Promise<MediaAssetView> {
  return asset(await api(actor, `/media/assets/${id}/complete`, { method: 'POST', body: JSON.stringify(input) }))
}

export async function attachArticleHero(actor: Actor, articleId: string, input: unknown): Promise<ArticleHeroView> {
  const raw = record(await api(actor, `/articles/${articleId}/hero`, { method: 'PUT', body: JSON.stringify(input) }))
  return {
    assetId: text(raw['assetId']), secureUrl: text(raw['secureUrl']), altText: text(raw['altText']),
    caption: text(raw['caption']), credit: text(raw['credit']), width: number(raw['width']), height: number(raw['height']),
  }
}
