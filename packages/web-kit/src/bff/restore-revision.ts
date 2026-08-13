import type { Actor, ArticleId, RevisionId } from '@kurasikapa/domain'
import { env } from '../composition/env'
import { apiPost } from './studio'

/**
 * Restore — via Go when API_URL is set, otherwise the TS use case.
 */
export async function restoreRevision(
  actor: Actor,
  parsed: { readonly articleId: string; readonly revisionId: string },
  viaTypeScript: (input: {
    actor: Actor
    articleId: ArticleId
    revisionId: RevisionId
  }) => Promise<{ seq: number }>,
): Promise<{ seq: number }> {
  const apiUrl = env().API_URL
  if (apiUrl === undefined) {
    return viaTypeScript({
      actor,
      articleId: parsed.articleId as ArticleId,
      revisionId: parsed.revisionId as RevisionId,
    })
  }

  const raw = await apiPost({
    baseUrl: apiUrl,
    userId: actor.id,
    path: `/articles/${parsed.articleId}/revisions/${parsed.revisionId}/restore`,
  })
  const seq = (raw as { seq?: unknown }).seq
  if (typeof seq !== 'number') {
    throw new Error('API returned an unrecognised restore body')
  }

  return { seq }
}
