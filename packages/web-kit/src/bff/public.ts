import type { ArticleHeroView, ArticleView } from '../read-model/article-view'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface PublicArticleDto {
  readonly id: string
  readonly authorId: string
  readonly slug: string
  readonly locale: string
  readonly title: string
  readonly categoryId: string
  readonly publishedAt: string | null
  readonly authorName?: string | null | undefined
  readonly hero: ArticleHeroView | null
}

export interface PublishedDto {
  readonly article: PublicArticleDto
  readonly body: string | null
}

export interface ListedPublicDto {
  readonly article: PublicArticleDto
  readonly excerpt: string | null
  readonly readingMinutes: number
}

export interface SectionDto {
  readonly id: string
  readonly slug: string
  readonly name: string
  readonly description: string | null
  readonly order: number
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
  const secureUrl = text(row['secureUrl'])
  if (assetId === '' || secureUrl === '') return null
  return {
    assetId, secureUrl, altText: text(row['altText']), caption: text(row['caption']),
    credit: text(row['credit']), width: Number(row['width']) || 0, height: Number(row['height']) || 0,
  }
}

export function publicArticleFrom(raw: unknown): PublicArticleDto {
  const body = asRecord(raw)
  return {
    id: text(body['id']),
    authorId: text(body['authorId']),
    slug: text(body['slug']),
    locale: text(body['locale']),
    title: text(body['title']),
    categoryId: text(body['categoryId']),
    publishedAt: instant(body['publishedAt']),
    hero: hero(body['hero']),
  }
}

export function toArticleViewFromDto(dto: PublicArticleDto): ArticleView {
  return {
    id: dto.id,
    slug: dto.slug,
    locale: dto.locale,
    title: dto.title,
    categoryId: dto.categoryId,
    publishedAt: dto.publishedAt,
    hero: dto.hero,
  }
}

export function nextCursorOf(raw: unknown): string | null {
  const body = asRecord(raw)
  return instant(body['nextCursor'])
}

export async function fetchPublic(baseUrl: string, path: string): Promise<unknown> {
  const response = await fetch(joinUrl(baseUrl, path))
  if (!response.ok) throw await problemFromResponse(response)
  return response.json() as Promise<unknown>
}
