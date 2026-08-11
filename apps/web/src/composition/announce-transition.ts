import {
  articleApproved,
  articleRejected,
  articleScheduled,
  articleSubmitted,
  articleUnpublished,
  type DomainEvent,
} from '@kurasikapa/application'
import { articleId, revisionId, userId } from '@kurasikapa/domain'
import { systemClock } from './ambient'
import { container } from './container'

type TransitionKind = 'submit' | 'approve' | 'reject' | 'schedule' | 'unpublish'

/**
 * Replay a transition announcement onto Next's event bus after a Go BFF call.
 *
 * Go's bus only logs. Audit (every event) and cache tags (unpublish) live here.
 */
export async function announceTransition(input: {
  readonly kind: TransitionKind
  readonly articleId: string
  readonly locale: string
  readonly actorId: string
  readonly revisionId?: string
  readonly note?: string
  readonly scheduledAt?: Date
  readonly reason?: string
}): Promise<void> {
  const at = {
    articleId: articleId(input.articleId),
    actorId: userId(input.actorId),
    occurredAt: systemClock.now(),
  }

  await container().events.publish(eventFor(input.kind, at, input))
}

function eventFor(
  kind: TransitionKind,
  at: {
    articleId: ReturnType<typeof articleId>
    actorId: ReturnType<typeof userId>
    occurredAt: Date
  },
  input: {
    readonly revisionId?: string
    readonly note?: string
    readonly scheduledAt?: Date
    readonly reason?: string
    readonly locale: string
  },
): DomainEvent {
  switch (kind) {
    case 'submit':
      return articleSubmitted(at)
    case 'approve':
      return articleApproved(at, revisionId(input.revisionId ?? ''))
    case 'reject':
      return articleRejected(at, input.note ?? '')
    case 'schedule':
      return articleScheduled(at, input.scheduledAt ?? at.occurredAt)
    case 'unpublish':
      return articleUnpublished(at, input.reason ?? '', input.locale)
  }
}
