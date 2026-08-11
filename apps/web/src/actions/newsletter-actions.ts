'use server'

import { container } from '../composition/container'
import { RateLimited, callerKey, limit } from '../security/rate-limit'
import { type ActionResult, attempt } from './result'
import { parseInput, subscribeNewsletterSchema, unsubscribeNewsletterSchema } from './schemas'

export async function subscribeNewsletterAction(
  input: unknown,
): Promise<ActionResult<{ state: string }>> {
  return attempt(async () => {
    const parsed = parseInput(subscribeNewsletterSchema, input)
    const graph = container()

    const verdict = await limit(
      graph.rateLimiter,
      await callerKey(null),
      'newsletter',
      'closed',
    )
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    return graph.subscribeNewsletter.execute(parsed)
  })
}

export async function unsubscribeNewsletterAction(
  input: unknown,
): Promise<ActionResult<{ state: string }>> {
  return attempt(async () => {
    const parsed = parseInput(unsubscribeNewsletterSchema, input)
    const graph = container()

    const verdict = await limit(
      graph.rateLimiter,
      await callerKey(null),
      'newsletter',
      'closed',
    )
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    return graph.unsubscribeNewsletter.execute(parsed)
  })
}
