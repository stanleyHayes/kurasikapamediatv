import type { DraftView } from '../read-model/studio-view'
import type { ArticleHeroView, ArticleNarrationView } from '../read-model/article-view'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface StudioArticleDto {
  readonly id: string
  readonly familyId: string
  readonly locale: string
  readonly slug: string
  readonly title: string
  readonly status: string
  readonly categoryId: string
  readonly publishedAt: string | null
  readonly scheduledAt: string | null
  readonly excerpt: string | null
  readonly hero: ArticleHeroView | null
  readonly narration: ArticleNarrationView | null
}

export interface RevisionDto {
  readonly id: string
  readonly seq: number
  readonly title: string
  readonly body: string
  readonly createdAt: string
  readonly excerpt: string
}

export interface DraftDto {
  readonly article: StudioArticleDto
  readonly latest: RevisionDto | null
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) return value as Record<string, unknown>
  return {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function instant(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function hero(value: unknown): ArticleHeroView | null {
  const row = asRecord(value)
  const assetId = text(row['assetId'])
  if (assetId === '') return null
  return { assetId, secureUrl: text(row['secureUrl']), altText: text(row['altText']), caption: text(row['caption']), credit: text(row['credit']), width: Number(row['width']) || 0, height: Number(row['height']) || 0 }
}

function narration(value: unknown): ArticleNarrationView | null {
  const row = asRecord(value)
  if (text(row['assetId']) === '' || row['mimeType'] !== 'audio/mpeg') return null
  return {
    assetId: text(row['assetId']), sourceRevisionId: text(row['sourceRevisionId']),
    secureUrl: text(row['secureUrl']), mimeType: 'audio/mpeg',
    durationSeconds: Number(row['durationSeconds']) || 0, voice: text(row['voice']),
  }
}

export function studioArticleFrom(raw: unknown): StudioArticleDto {
  const body = asRecord(raw)
  return {
    id: text(body['id']),
    familyId: text(body['familyId']),
    locale: text(body['locale']),
    slug: text(body['slug']),
    title: text(body['title']),
    status: text(body['status']),
    categoryId: text(body['categoryId']),
    publishedAt: instant(body['publishedAt']),
    scheduledAt: instant(body['scheduledAt']),
    excerpt: typeof body['excerpt'] === 'string' ? body['excerpt'] : null,
    hero: hero(body['hero']),
    narration: narration(body['narration']),
  }
}

export function toDraftView(dto: StudioArticleDto): DraftView {
  return {
    id: dto.id,
    title: dto.title,
    slug: dto.slug,
    locale: dto.locale,
    status: dto.status as DraftView['status'],
    publishedAt: dto.publishedAt,
    scheduledAt: dto.scheduledAt,
    categoryId: dto.categoryId,
    excerpt: dto.excerpt,
  }
}

export async function apiGet(input: {
  readonly baseUrl: string
  readonly userId: string
  readonly path: string
}): Promise<unknown> {
  const response = await fetch(joinUrl(input.baseUrl, input.path), {
    headers: { 'X-Kurasikapa-User': input.userId },
  })
  if (!response.ok) throw await problemFromResponse(response)
  return response.json() as Promise<unknown>
}

export async function apiPost(input: {
  readonly baseUrl: string
  readonly userId: string
  readonly path: string
}): Promise<unknown> {
  const response = await fetch(joinUrl(input.baseUrl, input.path), {
    method: 'POST',
    headers: { 'X-Kurasikapa-User': input.userId },
  })
  if (!response.ok) throw await problemFromResponse(response)
  return response.json() as Promise<unknown>
}
