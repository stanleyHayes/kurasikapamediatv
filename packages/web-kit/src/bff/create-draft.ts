import { readArticleView, type ArticleView } from './article-view'
import { actorHeaders } from './actor-headers'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

/**
 * Create a draft through the Go API.
 *
 * ADR-0009: session stays in Next; rules live in Go. Next forwards only the
 * user id; Go rebuilds the Actor from its own role store.
 *
 * Tag ids are omitted — the Go create-draft contract does not accept them yet.
 */
export async function createDraftViaApi(input: {
  readonly baseUrl: string
  readonly userId: string
  readonly locale: string
  readonly title: string
  readonly body: string
  readonly categoryId: string
  readonly familyId?: string
}): Promise<ArticleView> {
  const response = await fetch(joinUrl(input.baseUrl, '/articles'), {
    method: 'POST',
    headers: actorHeaders(input.userId, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      locale: input.locale,
      title: input.title,
      body: input.body,
      categoryId: input.categoryId,
      familyId: input.familyId ?? '',
    }),
  })

  if (!response.ok) {
    throw await problemFromResponse(response)
  }

  return readArticleView(response, input.locale)
}
