'use server'

import { articleId } from '@kurasikapa/domain'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { RateLimited, callerKey, limit } from '@kurasikapa/web-kit/security/rate-limit'
import { type ActionResult, attempt } from '@kurasikapa/web-kit/actions/result'
import { articleRefSchema, parseInput } from '@kurasikapa/web-kit/actions/schemas'

export async function sendBreakingAlertAction(
  input: unknown,
): Promise<ActionResult<{ sent: number }>> {
  return attempt(async () => {
    const parsed = parseInput(articleRefSchema, input)
    const actor = await requireActor()
    const graph = container()

    const verdict = await limit(graph.rateLimiter, await callerKey(actor.id), 'breaking', 'closed')
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    return graph.sendBreakingAlert.execute({ actor, articleId: articleId(parsed.articleId) })
  })
}
