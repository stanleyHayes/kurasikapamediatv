import type { RateLimiter } from '@kurasikapa/application'
import { limit, RateLimited } from '@kurasikapa/web-kit/security/rate-limit'

export async function enforceLiveActionPolicy(
  action: 'start' | 'end',
  limiter: RateLimiter,
  actorId: string,
): Promise<void> {
  // End must always reach provider cleanup; a limiter outage cannot hold a
  // billable channel open. Start provisions money-spending infrastructure and
  // remains tightly fail-closed.
  if (action === 'end') return
  const verdict = await limit(limiter, `actor:${actorId}`, 'live', 'closed')
  if (!verdict.allowed) throw new RateLimited(verdict.retryAfterSeconds)
}
