import { cacheLife, cacheTag } from 'next/cache'
import { container } from '../composition/container'
import { type ArticleView, toArticleView } from './article-view'

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

export async function cachedArticle(slug: string, locale: string): Promise<ArticleView | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(listTag(locale))

  const article = await container().getPublishedArticle.execute({ slug, locale })
  if (article === null) return null

  cacheTag(articleTag(article.id))
  return toArticleView(article)
}

export interface ArticleListView {
  readonly items: readonly ArticleView[]
  readonly nextCursor: string | null
}

export async function cachedLatest(locale: string, limit: number): Promise<ArticleListView> {
  'use cache'
  cacheLife('minutes')
  cacheTag(listTag(locale))

  const page = await container().listPublishedArticles.execute({ locale, limit })

  return {
    items: page.items.map(toArticleView),
    nextCursor: page.nextCursor,
  }
}
