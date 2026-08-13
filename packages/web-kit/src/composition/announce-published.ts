import { articlePublished } from '@kurasikapa/application'
import { articleId, userId } from '@kurasikapa/domain'
import { systemClock } from './ambient'
import { container } from './container'

/**
 * Replay a publish announcement onto Next's event bus after a Go BFF call.
 *
 * Go's bus only logs. Cache tags and the audit log live here, so a successful
 * Go publish that never announces here leaves the site stale and the record
 * blank — the visible half of a silent migration bug.
 */
export async function announcePublished(input: {
  readonly articleId: string
  readonly slug: string
  readonly locale: string
  readonly actorId: string
}): Promise<void> {
  await container().events.publish(
    articlePublished(
      {
        articleId: articleId(input.articleId),
        actorId: userId(input.actorId),
        occurredAt: systemClock.now(),
      },
      input.slug,
      input.locale,
    ),
  )
}
