import type { Actor, ArticleId } from '@kurasikapa/domain'
import { updateDraftViaApi } from './update-draft'

export interface UpdateDraftArgs {
  readonly articleId: string
  readonly title: string
  readonly body: string
}

/**
 * Update a draft — via Go when `API_URL` is set, otherwise the TS use case.
 */
export async function updateDraft(
  actor: Actor,
  parsed: UpdateDraftArgs,
  apiUrl: string | undefined,
  viaTypeScript: (input: {
    actor: Actor
    articleId: ArticleId
    title: string
    body: string
  }) => Promise<{ seq: number; slug: string }>,
): Promise<{ seq: number; slug: string }> {
  if (apiUrl === undefined) {
    return viaTypeScript({
      actor,
      articleId: parsed.articleId as ArticleId,
      title: parsed.title,
      body: parsed.body,
    })
  }

  return updateDraftViaApi({
    baseUrl: apiUrl,
    userId: actor.id,
    articleId: parsed.articleId,
    title: parsed.title,
    body: parsed.body,
  })
}
