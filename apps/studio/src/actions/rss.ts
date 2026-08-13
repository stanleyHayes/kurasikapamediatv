'use server'

import { categoryId } from '@kurasikapa/domain'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { RateLimited, callerKey, limit } from '@kurasikapa/web-kit/security/rate-limit'
import { type ActionResult, attempt } from '@kurasikapa/web-kit/actions/result'
import { parseInput, registerRssSourceSchema } from '@kurasikapa/web-kit/actions/schemas'

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
