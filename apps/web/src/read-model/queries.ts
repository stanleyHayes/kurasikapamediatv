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
export const sectionTag = (slug: string, locale: string): string => `section-${locale}-${slug}`

export interface ReadableArticle extends ArticleView {
  readonly body: string | null
}

export async function cachedArticle(
  slug: string,
  locale: string,
): Promise<ReadableArticle | null> {
  'use cache'
  cacheLife('hours')
  cacheTag(listTag(locale))

  const found = await container().getPublishedArticle.execute({ slug, locale })
  if (found === null) return null

  cacheTag(articleTag(found.article.id))
  return { ...toArticleView(found.article), body: found.body }
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

/** An article as a listing shows it: the card data plus its standfirst. */
export interface ListedArticleView extends ArticleView {
  readonly excerpt: string | null
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

  const result = await container().browseCategory.execute({ slug, locale })
  if (result === null) return null

  return {
    name: result.category.nameIn(locale),
    // Legal here precisely because this function is cached: a non-deterministic
    // value inside 'use cache' is evaluated once per entry, not per request.
    now: new Date().toISOString(),
    description: result.category.descriptionIn(locale),
    articles: result.articles.items.map(({ article, excerpt }) => ({
      ...toArticleView(article),
      excerpt,
    })),
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
