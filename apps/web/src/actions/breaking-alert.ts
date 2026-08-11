'use server'

import { articleId } from '@kurasikapa/domain'
import { requireActor } from '../composition/actor'
import { container } from '../composition/container'
import { RateLimited, callerKey, limit } from '../security/rate-limit'
import { type ActionResult, attempt } from './result'
import { articleRefSchema, parseInput } from './schemas'

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
