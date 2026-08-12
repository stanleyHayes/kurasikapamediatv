'use server'

import { container } from '../composition/container'
import { RateLimited, callerKey, limit } from '../security/rate-limit'
import { type ActionResult, attempt } from './result'
import { contactMessageSchema, parseInput } from './schemas'

export async function submitContactMessageAction(
  input: unknown,
): Promise<ActionResult<{ sent: true }>> {
  return attempt(async () => {
    const parsed = parseInput(contactMessageSchema, input)
    const graph = container()

    const verdict = await limit(
      graph.rateLimiter,
      await callerKey(null),
      'contact',
      'closed',
    )
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    return graph.submitContactMessage.execute(parsed)
  })
}
