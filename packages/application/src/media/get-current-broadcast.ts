import type { BroadcastId, LiveCaptionMode } from '@kurasikapa/domain'
import type { BroadcastRepository } from '../ports/broadcast-repository'
import type { UseCase } from '../ports/use-case'

export interface GetCurrentBroadcastDeps {
  readonly broadcasts: BroadcastRepository
}

export interface GetCurrentBroadcastInput {
  readonly locale: string
}

/**
 * What the public player is given — a projection, deliberately not the
 * aggregate.
 *
 * Returning the `Broadcast` would put `channelArn` one `.snapshot()` away from
 * any page, cache entry or JSON response that touches it, and infrastructure
 * handles are what an attacker enumerates the station's AWS estate with. Every
 * field below is something a reader is meant to see; anything new added here
 * has to clear that bar.
 */
export interface LiveBroadcast {
  readonly id: BroadcastId
  readonly title: string
  readonly locale: string
  readonly playbackUrl: string
  readonly captionMode: LiveCaptionMode
  readonly startedAt: Date | null
}

/**
 * The reader-facing "are we on air?" lookup. Unauthenticated: this is what the
 * homepage asks on every request, for everyone.
 */
export class GetCurrentBroadcast
  implements UseCase<GetCurrentBroadcastInput, LiveBroadcast | null>
{
  constructor(private readonly deps: GetCurrentBroadcastDeps) {}

  async execute(input: GetCurrentBroadcastInput): Promise<LiveBroadcast | null> {
    const broadcast = await this.deps.broadcasts.currentLive(input.locale)
    if (broadcast === null) return null

    // Asked again even though the repository filtered, for the same reason
    // GetPublishedArticle re-checks visibility: a query that merely forgot its
    // state predicate would put a scheduled — or torn-down — broadcast on the
    // front page, and that mistake must not depend on a database to catch.
    if (!broadcast.isLive()) return null

    return {
      id: broadcast.id,
      title: broadcast.title,
      locale: broadcast.locale,
      playbackUrl: broadcast.playbackUrl,
      captionMode: broadcast.captionMode,
      startedAt: broadcast.startedAt,
    }
  }
}
