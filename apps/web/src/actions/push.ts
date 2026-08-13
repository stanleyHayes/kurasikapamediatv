'use server'

import { container } from '@kurasikapa/web-kit/composition/container'
import { RateLimited, callerKey, limit } from '@kurasikapa/web-kit/security/rate-limit'
import { type ActionResult, attempt } from '@kurasikapa/web-kit/actions/result'
import { parseInput, subscribePushSchema, unsubscribePushSchema } from '@kurasikapa/web-kit/actions/schemas'

export async function subscribePushAction(
  input: unknown,
): Promise<ActionResult<{ endpoint: string }>> {
  return attempt(async () => {
    const parsed = parseInput(subscribePushSchema, input)
    const graph = container()
    const verdict = await limit(graph.rateLimiter, await callerKey(null), 'push', 'closed')
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    return graph.subscribePush.execute(parsed)
  })
}

export async function unsubscribePushAction(
  input: unknown,
): Promise<ActionResult<{ removed: true }>> {
  return attempt(async () => {
    const parsed = parseInput(unsubscribePushSchema, input)
    return container().unsubscribePush.execute(parsed)
  })
}
