import type { Actor, ArticleId } from '@kurasikapa/domain'
import { announceTransition } from '../composition/announce-transition'
import { transitionViaApi, type TransitionKind } from './transition'

export type TransitionRequest =
  | { readonly kind: 'submit'; readonly articleId: string }
  | { readonly kind: 'approve'; readonly articleId: string; readonly revisionId: string }
  | { readonly kind: 'reject'; readonly articleId: string; readonly note: string }
  | { readonly kind: 'schedule'; readonly articleId: string; readonly at: Date }
  | { readonly kind: 'unpublish'; readonly articleId: string; readonly reason: string }

/**
 * Editorial transitions — via Go when `API_URL` is set.
 *
 * After a Go call, announces onto Next's event bus so audit (and unpublish
 * cache invalidation) stay in sync. Go's bus only logs.
 */
export async function transitionArticle(
  actor: Actor,
  request: TransitionRequest,
  apiUrl: string | undefined,
  viaTypeScript: (input: {
    actor: Actor
    articleId: ArticleId
  }) => Promise<{ status: string }>,
): Promise<{ status: string }> {
  if (apiUrl === undefined) {
    return viaTypeScript({ actor, articleId: request.articleId as ArticleId })
  }

  const result = await transitionViaApi({
    baseUrl: apiUrl,
    userId: actor.id,
    ...toApiArgs(request),
  })

  await announceTransition({
    kind: request.kind,
    articleId: result.id,
    locale: result.locale,
    actorId: actor.id,
    ...(request.kind === 'approve' ? { revisionId: request.revisionId } : {}),
    ...(request.kind === 'reject' ? { note: request.note } : {}),
    ...(request.kind === 'schedule' ? { scheduledAt: request.at } : {}),
    ...(request.kind === 'unpublish' ? { reason: request.reason } : {}),
  })

  return { status: result.status }
}

function toApiArgs(request: TransitionRequest): {
  kind: TransitionKind
  articleId: string
  revisionId?: string
  note?: string
  at?: Date
  reason?: string
} {
  switch (request.kind) {
    case 'submit':
      return { kind: 'submit', articleId: request.articleId }
    case 'approve':
      return {
        kind: 'approve',
        articleId: request.articleId,
        revisionId: request.revisionId,
      }
    case 'reject':
      return { kind: 'reject', articleId: request.articleId, note: request.note }
    case 'schedule':
      return { kind: 'schedule', articleId: request.articleId, at: request.at }
    case 'unpublish':
      return {
        kind: 'unpublish',
        articleId: request.articleId,
        reason: request.reason,
      }
  }
}
