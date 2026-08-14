import type { Actor, BroadcastId } from '@kurasikapa/domain'
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

    const now = this.deps.clock.now()
    const ended = broadcast.end(input.actor, now)

    // Record first, tear down second — never the other way round.
    //
    // Tearing down first and then failing to save leaves a record saying "live"
    // against a channel that no longer exists: `currentLive` keeps serving it
    // and every reader gets a player that spins forever. This order's worst
    // case is a channel that outlives its record — still billing, but visible
    // by its ARN and reapable by a retry, because teardown is idempotent.
    await this.deps.broadcasts.save(ended)

    // A teardown failure is not swallowed. The broadcast is off air either way,
    // so the caller could be told "done" — but then a live channel bills on
    // with nobody aware of it. An error an operator can retry is the cheaper
    // outcome.
    await this.deps.live.teardown(ended.channelArn)

    return { broadcastId: ended.id, endedAt: now }
  }
}
