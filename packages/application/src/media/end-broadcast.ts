import { type Actor, type BroadcastId, requirePermission } from '@kurasikapa/domain'
import type { ClockPort } from '../ports/ambient'
import type { BroadcastRepository } from '../ports/broadcast-repository'
import type { LiveVideoPort } from '../ports/live-video'
import type { UseCase } from '../ports/use-case'
import { BroadcastNotFound } from './errors'

export interface EndBroadcastDeps {
  readonly broadcasts: BroadcastRepository
  readonly live: LiveVideoPort
  readonly clock: ClockPort
}

export interface EndBroadcastInput {
  readonly actor: Actor
  readonly broadcastId: BroadcastId
}

export interface EndBroadcastResult {
  readonly broadcastId: BroadcastId
  readonly endedAt: Date
}

/**
 * Takes the station off air and releases the channel.
 *
 * `stream:manage` is enforced by `Broadcast.end` rather than repeated here.
 * Unlike StartBroadcast — which must refuse before it provisions — nothing
 * irreversible happens ahead of the aggregate, so the domain check is both the
 * rule and the gate.
 */
export class EndBroadcast implements UseCase<EndBroadcastInput, EndBroadcastResult> {
  constructor(private readonly deps: EndBroadcastDeps) {}

  async execute(input: EndBroadcastInput): Promise<EndBroadcastResult> {
    const broadcast = await this.deps.broadcasts.findById(input.broadcastId)
    if (broadcast === null) throw new BroadcastNotFound(input.broadcastId)

    // Retry after a provider failure: the record was intentionally persisted
    // as ended before teardown. Permission is still checked before revealing
    // or touching its provider handle.
    if (broadcast.state === 'ended') {
      requirePermission(input.actor, 'stream:manage')
      await this.deps.live.teardown(broadcast.channelArn)
      const endedAt = broadcast.endedAt
      if (endedAt === null) throw new Error(`Ended broadcast ${broadcast.id} has no end timestamp`)
      return { broadcastId: broadcast.id, endedAt }
    }

    const now = this.deps.clock.now()
    const ended = broadcast.end(input.actor, now)

    // Provider first, record second. If teardown fails the row stays live, so
    // the control room retains its cleanup button and a new start remains
    // blocked. If save fails after teardown, retry is safe because provider
    // teardown is idempotent (a missing channel is success).
    await this.deps.live.teardown(ended.channelArn)
    await this.deps.broadcasts.save(ended)

    return { broadcastId: ended.id, endedAt: now }
  }
}
