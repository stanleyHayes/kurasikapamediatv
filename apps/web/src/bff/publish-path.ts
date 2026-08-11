import type { Actor, ArticleId } from '@kurasikapa/domain'
import { announcePublished } from '../composition/announce-published'
import { publishViaApi } from './publish'

/**
 * Publish — via Go when `API_URL` is set, otherwise the TS use case.
 *
 * After a Go publish, announces onto Next's event bus so cache tags and the
 * audit log stay in sync (Go's bus only logs).
 */
export async function publishArticle(
  actor: Actor,
  articleId: string,
  apiUrl: string | undefined,
  viaTypeScript: (input: {
    actor: Actor
    articleId: ArticleId
  }) => Promise<{ slug: string; locale: string }>,
): Promise<{ slug: string; locale: string }> {
  if (apiUrl === undefined) {
    return viaTypeScript({ actor, articleId: articleId as ArticleId })
  }

  const article = await publishViaApi({
    baseUrl: apiUrl,
    userId: actor.id,
    articleId,
  })

  await announcePublished({
    articleId: article.id,
    slug: article.slug,
    locale: article.locale,
    actorId: actor.id,
  })

  return { slug: article.slug, locale: article.locale }
}
