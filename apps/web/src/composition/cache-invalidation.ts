import type { DomainEvent } from '@kurasikapa/application'

export interface CacheTags {
  /** Refreshed within the current request — the reader sees it immediately. */
  update(tag: string): void
  /** Refreshed in the background — stale is served until it lands. */
  revalidate(tag: string): void
}

interface ArticleEventShape {
  readonly articleId: string
  readonly locale?: string
}

const hasArticle = (event: DomainEvent): event is DomainEvent & ArticleEventShape =>
  'articleId' in event && typeof (event as { articleId: unknown }).articleId === 'string'

/**
 * Turns editorial events into cache invalidation.
 *
 * The distinction matters. Publishing uses `update`, so the article is live
 * inside the request that published it — the questionnaire asks for breaking
 * news, and "live within a minute" is not the same promise. The listing rails
 * use `revalidate`, because a homepage that is 30 seconds stale is fine and
 * blocking the publish on rebuilding every rail is not.
 */
export function invalidateFor(tags: CacheTags, event: DomainEvent): void {
  if (!hasArticle(event)) return

  switch (event.name) {
    case 'article.published':
    case 'article.unpublished': {
      tags.update(`article-${event.articleId}`)
      if (event.locale !== undefined) tags.revalidate(`articles-${event.locale}`)
      return
    }

    // A correction to live text must reach readers, but an approval or a
    // rejection changes nothing a reader can see, so it invalidates nothing.
    default:
      return
  }
}
