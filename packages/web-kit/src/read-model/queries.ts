import { cacheLife, cacheTag } from 'next/cache'
import { articleId } from '@kurasikapa/domain'
import { loadPublishedArticle, loadPublishedList, loadSectionPage } from '../bff/load-public'
import { loadSemanticRelated, loadSemanticSearch } from '../bff/semantic'
import { container } from '../composition/container'
import { env } from '../composition/env'
import {
  type ArticleView,
  type CardArticleView,
  type ListedArticleView,
  type ReadableArticle,
  toArticleView,
} from './article-view'

export type { ListedArticleView, ReadableArticle }

/**
 * Cached read paths for the public site.
 *
 * These are the `use cache` boundary. Note what is NOT here: no `cookies()`,
 * no `headers()`, no `searchParams`. Everything a cached function needs
 * arrives as an argument, which is both the framework's rule and what makes
 * the cache key correct.
 *
 * Tags are what let publishing invalidate a page inside the same request —
 * see docs/03-architecture.md § 5.
 */

export const articleTag = (id: string): string => `article-${id}`
export const listTag = (locale: string): string => `articles-${locale}`
export const sectionTag = (slug: string, locale: string): string => `section-${locale}-${slug}`

export async function cachedArticle(
  slug: string,
  locale: string,
): Promise<ReadableArticle | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(listTag(locale))

  const found = await loadPublishedArticle(slug, locale, env().API_URL, async () => {
    const loaded = await container().getPublishedArticle.execute({ slug, locale })
    if (loaded === null) return null
    const authorName = await container().resolvePublicByline.execute({
      userId: loaded.article.authorId,
    })
		return { ...toArticleView(loaded.article), body: loaded.body, modifiedAt: loaded.modifiedAt?.toISOString() ?? null, authorId: loaded.article.authorId, authorName }
  })
  if (found === null) return null

  cacheTag(articleTag(found.id))
  return found
}

export interface ArticleListView {
  readonly items: readonly CardArticleView[]
  readonly nextCursor: string | null
}

export async function cachedLatest(locale: string, limit: number): Promise<ArticleListView> {
  'use cache'
  cacheLife('minutes')
  cacheTag(listTag(locale))

  return loadPublishedList({ locale, limit }, env().API_URL, async () => {
    const page = await container().listPublishedArticles.execute({ locale, limit })
    return {
      items: page.items.map(({ article, excerpt, readingMinutes }) => ({
        ...toArticleView(article), excerpt, readingMinutes,
      })),
      nextCursor: page.nextCursor,
    }
  })
}

/**
 * Unique-reader ranking for Trending Now.
 *
 * Cached on minutes, not invalidated from the reading beacon: a homepage
 * rebuild on every signed-in pageview would be the expensive kind of freshness.
 * Publishing still busts `articles-{locale}`, so a takedown leaves the rail.
 */
export async function cachedMostRead(locale: string, limit: number): Promise<readonly ArticleView[]> {
  'use cache'
  cacheLife('minutes')
  cacheTag(listTag(locale))

  // Audience ranking has not moved to the Go API yet. In an API-backed
  // deployment, returning no ranking lets `homeRails` fill Trending from the
  // already-loaded recency rail without opening a second Mongo connection.
  // This also keeps public-page prerendering independent of the database.
  if (env().API_URL !== undefined) return []

  return (await container().listMostRead.execute({ locale, limit })).map(toArticleView)
}

/** Semantic neighbours when ready, with same-section siblings as fallback. */
export interface RelatedArticleView {
  readonly items: readonly ArticleView[]
  readonly mode: 'semantic' | 'section'
}

export async function cachedRelated(
  id: string,
  locale: string,
  limit: number,
): Promise<RelatedArticleView> {
  'use cache'
  cacheLife('minutes')
  cacheTag(listTag(locale))
  cacheTag(articleTag(id))

  const apiUrl = env().API_URL
  if (apiUrl !== undefined) {
    try {
      const semantic = await loadSemanticRelated(apiUrl, locale, id, limit)
      if (semantic.length > 0) return { items: semantic, mode: 'semantic' }
    } catch {
      // Discovery is an enhancement. Same-section reporting remains useful
      // while the embedding provider or Atlas vector index is unavailable.
    }
  }
  const section = await container().listRelatedArticles.execute({ articleId: articleId(id), limit })
  return { items: section.map(toArticleView), mode: 'section' }
}

export interface SearchResultView {
  readonly id: string
  readonly slug: string
  readonly title: string
}

export async function searchReporting(terms: string, locale: string): Promise<readonly SearchResultView[]> {
  const apiUrl = env().API_URL
  if (apiUrl !== undefined) {
    try {
      const semantic = await loadSemanticSearch(apiUrl, locale, terms, 20)
      if (semantic.length > 0) return semantic.map(({ id, slug, title }) => ({ id, slug, title }))
    } catch {
      // Lexical search is the production fallback, not an error page.
    }
  }
  const lexical = await container().searchArticles.execute({ terms, locale })
  return lexical.items.map(({ articleId: id, slug, title }) => ({ id, slug, title }))
}

export interface SectionView {
  readonly name: string
  /**
   * The instant this cache entry was built.
   *
   * Relative timestamps ("2 hours ago") need a reference point, and a Server
   * Component may not read the clock. Capturing it here is legal precisely
   * because this function is cached: the value is evaluated once per entry.
   */
  readonly now: string
  /** Null when this locale has no translated standfirst — never another locale's. */
  readonly description: string | null
  readonly articles: readonly ListedArticleView[]
}

export async function cachedSection(slug: string, locale: string): Promise<SectionView | null> {
  'use cache'
  cacheLife('minutes')
  cacheTag(listTag(locale))
  cacheTag(sectionTag(slug, locale))

  const result = await loadSectionPage(slug, locale, env().API_URL, async () => {
    const loaded = await container().browseCategory.execute({ slug, locale })
    if (loaded === null) return null
    return {
      name: loaded.category.nameIn(locale),
      description: loaded.category.descriptionIn(locale),
      articles: loaded.articles.items.map(({ article, excerpt, readingMinutes }) => ({
        ...toArticleView(article),
        excerpt,
        readingMinutes,
      })),
    }
  })
  if (result === null) return null

  return {
    name: result.name,
    // Legal here precisely because this function is cached: a non-deterministic
    // value inside 'use cache' is evaluated once per entry, not per request.
    now: new Date().toISOString(),
    description: result.description,
    articles: result.articles,
  }
}

/**
 * Key Takeaways for the reader-facing AI panel.
 *
 * Cached under the article's own tag, so the model runs once per published
 * version and republishing regenerates it — not once per page view. A news
 * site's traffic is overwhelmingly reads of the same few stories; billing an
 * Anthropic call against each one would be indefensible.
 *
 * Returns null rather than throwing when the model is unreachable or no key
 * is configured. Takeaways are an enhancement; an article that cannot be read
 * because a summariser was down would be a worse failure than no summary.
 */
export async function cachedTakeaways(
  articleId: string,
  title: string,
  body: string,
  locale: string,
): Promise<readonly string[] | null> {
  'use cache'
  cacheLife('days')
  cacheTag(articleTag(articleId))

  try {
    const summary = await container().ai.summarise({ title, body, locale })
    return summary.bullets.length > 0 ? summary.bullets : null
  } catch {
    return null
  }
}
