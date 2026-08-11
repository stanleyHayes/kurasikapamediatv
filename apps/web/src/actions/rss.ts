'use server'

import { categoryId } from '@kurasikapa/domain'
import { requireActor } from '../composition/actor'
import { container } from '../composition/container'
import { RateLimited, callerKey, limit } from '../security/rate-limit'
import { type ActionResult, attempt } from './result'
import { parseInput, registerRssSourceSchema } from './schemas'

export async function registerRssSourceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const parsed = parseInput(registerRssSourceSchema, input)
    const actor = await requireActor()
    const graph = container()
    const verdict = await limit(graph.rateLimiter, await callerKey(actor.id), 'rss', 'closed')
    if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)

    return graph.registerRssSource.execute({
      actor,
      url: parsed.url,
      locale: parsed.locale,
      categoryId: categoryId(parsed.categoryId),
    })
  })
}
