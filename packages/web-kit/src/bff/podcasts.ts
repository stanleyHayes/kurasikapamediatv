import type { Actor } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { fetchPublic } from './public'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface PodcastEpisodeView {
  readonly id: string; readonly podcastId: string; readonly title: string; readonly slug: string
  readonly locale: string; readonly summary: string; readonly audioUrl: string; readonly transcriptUrl: string
  readonly audioBytes: number; readonly audioMimeType: string; readonly durationSeconds: number; readonly publishedAt: string
  readonly chapters: readonly { readonly title: string; readonly startsAtSec: number }[]
}
export interface PodcastView {
  readonly id: string; readonly title: string; readonly slug: string; readonly locale: string
  readonly summary: string; readonly author: string; readonly artworkUrl: string
  readonly episodes: readonly PodcastEpisodeView[]
}

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {} }
function text(value: unknown): string { return typeof value === 'string' ? value : '' }
function number(value: unknown): number { return typeof value === 'number' ? value : 0 }
function episode(raw: unknown): PodcastEpisodeView {
  const row = record(raw)
  const chapters = Array.isArray(row['chapters']) ? row['chapters'].map((item) => {
    const chapter = record(item); return { title: text(chapter['Title'] ?? chapter['title']), startsAtSec: number(chapter['StartsAtSec'] ?? chapter['startsAtSec']) }
  }) : []
  return { id: text(row['id']), podcastId: text(row['podcastId']), title: text(row['title']), slug: text(row['slug']), locale: text(row['locale']), summary: text(row['summary']), audioUrl: text(row['audioUrl']), transcriptUrl: text(row['transcriptUrl']), audioBytes: number(row['audioBytes']), audioMimeType: text(row['audioMimeType']), durationSeconds: number(row['durationSeconds']), publishedAt: text(row['publishedAt']), chapters }
}
function podcast(raw: unknown): PodcastView {
  const row = record(raw)
  return { id: text(row['id']), title: text(row['title']), slug: text(row['slug']), locale: text(row['locale']), summary: text(row['summary']), author: text(row['author']), artworkUrl: text(row['artworkUrl']), episodes: Array.isArray(row['episodes']) ? row['episodes'].map(episode) : [] }
}
export async function loadPodcasts(locale: string): Promise<readonly PodcastView[]> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) return []
  const body = record(await fetchPublic(apiUrl, `/public/${locale}/podcasts`))
  return Array.isArray(body['items']) ? body['items'].map(podcast) : []
}
async function post(actor: Actor, path: string, body?: unknown): Promise<Record<string, unknown>> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) throw new Error('API_URL is required for podcast publishing')
  const response = await fetch(joinUrl(apiUrl, path), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kurasikapa-User': actor.id }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  if (!response.ok) throw await problemFromResponse(response)
  return record(await response.json())
}
export async function createAndPublishPodcast(actor: Actor, input: unknown): Promise<{ readonly id: string }> {
  const created = await post(actor, '/media/podcasts', input)
  const id = text(created['id']); await post(actor, `/media/podcasts/${id}/publish`)
  return { id }
}
export async function createAndPublishEpisode(actor: Actor, input: unknown): Promise<{ readonly id: string }> {
  const created = await post(actor, '/media/episodes', input)
  const id = text(created['id']); await post(actor, `/media/episodes/${id}/publish`)
  return { id }
}
