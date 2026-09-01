import { publicBylineName } from '@kurasikapa/application'
import type { CardArticleView, ListedArticleView, ReadableArticle } from '../read-model/article-view'
import { ApiProblem } from './problem'
import {
  fetchPublic,
  nextCursorOf,
  publicArticleFrom,
  toArticleViewFromDto,
  type ListedPublicDto,
  type PublishedDto,
  type SectionDto,
} from './public'

export interface PublicPageView {
  readonly items: readonly CardArticleView[]
  readonly nextCursor: string | null
}

export interface SectionNavItem {
  readonly slug: string
}

export interface SectionPageView {
  readonly name: string
  readonly description: string | null
  readonly articles: readonly ListedArticleView[]
}

function itemsOf(raw: unknown): readonly unknown[] {
  const body = raw as { items?: unknown }
  return Array.isArray(body.items) ? body.items : []
}

async function orNull<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof ApiProblem && error.type === 'not_found') return null
    throw error
  }
}

export async function loadPublishedArticle(
  slug: string,
  locale: string,
  apiUrl: string | undefined,
  viaTypeScript: () => Promise<ReadableArticle | null>,
): Promise<ReadableArticle | null> {
  if (apiUrl === undefined) return viaTypeScript()

  return orNull(async () => {
    const raw = (await fetchPublic(apiUrl, `/public/${locale}/articles/${slug}`)) as PublishedDto
    return {
      ...toArticleViewFromDto(publicArticleFrom(raw.article)),
      body: typeof raw.body === 'string' ? raw.body : null,
		modifiedAt: typeof raw.modifiedAt === 'string' ? raw.modifiedAt : null,
      authorId: raw.article.authorId,
      authorName: publicBylineName(typeof raw.article.authorName === 'string' ? raw.article.authorName : ''),
    }
  })
}

export async function loadPublishedList(
  input: { readonly locale: string; readonly limit: number; readonly after?: string | undefined },
  apiUrl: string | undefined,
  viaTypeScript: () => Promise<PublicPageView>,
): Promise<PublicPageView> {
  if (apiUrl === undefined) return viaTypeScript()

  const query = new URLSearchParams({ limit: String(input.limit) })
  if (input.after !== undefined && input.after !== '') query.set('after', input.after)
  const raw = await fetchPublic(apiUrl, `/public/${input.locale}/articles?${query.toString()}`)
  return {
    items: itemsOf(raw).map((row) => {
      const listed = listedFrom(row)
      return { ...toArticleViewFromDto(listed.article), excerpt: listed.excerpt, readingMinutes: listed.readingMinutes }
    }),
    nextCursor: nextCursorOf(raw),
  }
}

export async function loadSectionPage(
  slug: string,
  locale: string,
  apiUrl: string | undefined,
  viaTypeScript: () => Promise<SectionPageView | null>,
): Promise<SectionPageView | null> {
  if (apiUrl === undefined) return viaTypeScript()

  return orNull(async () => {
    const raw = asPage(await fetchPublic(apiUrl, `/public/${locale}/sections/${slug}`))
    return {
      name: raw.category.name,
      description: raw.category.description,
      articles: raw.articles.items.map((row) => ({
        ...toArticleViewFromDto(row.article),
        excerpt: row.excerpt,
        readingMinutes: row.readingMinutes,
      })),
    }
  })
}

const emptySection: SectionDto = {
  id: '',
  slug: '',
  name: '',
  description: null,
  order: 0,
}

function sectionFrom(raw: SectionDto | undefined): SectionDto {
  return raw ?? emptySection
}

function listedFrom(row: unknown): ListedPublicDto {
  const item = row as { article?: unknown; excerpt?: unknown; readingMinutes?: unknown }
  return {
    article: publicArticleFrom(item.article),
    excerpt: typeof item.excerpt === 'string' ? item.excerpt : null,
    readingMinutes: typeof item.readingMinutes === 'number' ? item.readingMinutes : 1,
  }
}

function asPage(raw: unknown): {
  readonly category: SectionDto
  readonly articles: { readonly items: readonly ListedPublicDto[] }
} {
  const body = raw as { category?: SectionDto; articles?: { items?: unknown[] } }
  const rows = Array.isArray(body.articles?.items) ? body.articles.items : []
  return { category: sectionFrom(body.category), articles: { items: rows.map(listedFrom) } }
}

export async function loadSections(
  locale: string,
  apiUrl: string | undefined,
  viaTypeScript: () => Promise<readonly SectionNavItem[]>,
): Promise<readonly SectionNavItem[]> {
  if (apiUrl === undefined) return viaTypeScript()

  const raw = await fetchPublic(apiUrl, `/public/${locale}/sections`)
  return itemsOf(raw).map((row) => ({ slug: (row as SectionDto).slug }))
}
