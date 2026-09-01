import {
  type Actor,
  Broadcast,
  LiveCaptionsRequired,
  type BroadcastId,
  broadcastId,
  requirePermission,
} from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { BroadcastRepository } from '../ports/broadcast-repository'
import type { LiveVideoPort } from '../ports/live-video'
import type { UseCase } from '../ports/use-case'
import { AlreadyBroadcasting, CleanupRequired } from './errors'

export interface StartBroadcastDeps {
  readonly broadcasts: BroadcastRepository
  readonly live: LiveVideoPort
  readonly clock: ClockPort
  readonly ids: IdPort
}

export interface StartBroadcastInput {
  readonly actor: Actor
  readonly title: string
  readonly locale: string
  readonly captionsConfirmed: boolean
}

/**
 * What the operator needs to get on air.
 *
 * `streamKey` appears here and nowhere else in the system: this response is the
 * one moment it exists outside the provider. Whatever renders it must show it
 * once and must not log, cache or echo it back — see `ProvisionedChannel`.
 */
export interface StartBroadcastResult {
  readonly broadcastId: BroadcastId
  readonly ingestEndpoint: string
  readonly streamKey: string
  readonly playbackUrl: string
}

/**
 * Provisions a channel and puts the station on air.
 *
 * The order is load-bearing throughout: check, provision, record. Everything
 * that can refuse the request runs before anything is created at the provider,
 * because a channel created for a request we then reject bills by the hour and
 * has nothing pointing at it to find it by.
 */
export class StartBroadcast implements UseCase<StartBroadcastInput, StartBroadcastResult> {
  constructor(private readonly deps: StartBroadcastDeps) {}

  async execute(input: StartBroadcastInput): Promise<StartBroadcastResult> {
    // Checked here as well as inside the aggregate. `Broadcast.schedule` cannot
    // run until a channel exists to name, so relying on its check alone would
    // provision — and bill for — a channel for an actor we were always going to
    // refuse. The domain check remains the rule; this one is a cheap gate.
    requirePermission(input.actor, 'stream:manage')
    if (!input.captionsConfirmed) throw new LiveCaptionsRequired()

    const onAir = await this.deps.broadcasts.currentLive(input.locale)
    if (onAir !== null) throw new AlreadyBroadcasting(input.locale, onAir.id)

    const channel = await this.deps.live.provision({ name: `${input.locale}: ${input.title}` })
    const now = this.deps.clock.now()

    // Scheduled and live in one step. An operator pressing "go live" has no
    // separate scheduled phase to observe, and leaving the record in
    // `scheduled` until a second call would make `currentLive` blind to a
    // channel that is already ingesting.
    const broadcast = Broadcast.schedule(input.actor, {
      id: broadcastId(this.deps.ids.next()),
      title: input.title,
      locale: input.locale,
      channelArn: channel.channelArn,
      playbackUrl: channel.playbackUrl,
      captionMode: 'in_band',
      scheduledFor: now,
    }).goLive(input.actor, now)

    await this.record(broadcast, channel.channelArn)

    return {
      broadcastId: broadcast.id,
      ingestEndpoint: channel.ingestEndpoint,
      streamKey: channel.streamKey,
      playbackUrl: channel.playbackUrl,
    }
  }

  private async record(broadcast: Broadcast, channelArn: string): Promise<void> {
    try {
      await this.deps.broadcasts.save(broadcast)
    } catch (error) {
      // A channel we provisioned but never recorded is unreachable: no row
      // holds its ARN, so no EndBroadcast will ever tear it down and it bills
      // until somebody notices it in the AWS console. Undo the provision.
      //
      // If compensation also fails, surface a non-secret reconciliation handle
      // so an operator can delete the billable channel explicitly.
      try {
        await this.deps.live.teardown(channelArn)
      } catch (cleanupFailure) {
        throw new CleanupRequired(channelArn, error, cleanupFailure)
      }
      throw error
    }
  }
}
