import { type Actor, requirePermission } from '../identity/actor'
import type { BroadcastId, UserId } from '../shared/ids'
import type { BroadcastState } from './broadcast-state'
import { AlreadyLive, BroadcastHasEnded, LiveCaptionsRequired, NotLive } from './errors'

export type LiveCaptionMode = 'in_band' | 'unverified'

export interface BroadcastProps {
  readonly id: BroadcastId
  readonly title: string
  /** Its own locale, like an article's: the French bulletin is its own broadcast. */
  readonly locale: string
  /** The provider handle for the channel this broadcast owns. Never shown to a reader. */
  readonly channelArn: string
  /** The public HLS URL the player loads. Meant to be shared. */
  readonly playbackUrl: string
  readonly captionMode: LiveCaptionMode
  readonly state: BroadcastState
  readonly scheduledFor: Date
  readonly startedAt: Date | null
  readonly endedAt: Date | null
  readonly createdBy: UserId
}

/** What a caller supplies to schedule one. State and stamps are derived. */
export interface NewBroadcast {
  readonly id: BroadcastId
  readonly title: string
  readonly locale: string
  readonly channelArn: string
  readonly playbackUrl: string
  readonly captionMode: LiveCaptionMode
  readonly scheduledFor: Date
}

/**
 * One live transmission, on one channel, in one locale.
 *
 *   scheduled ──goLive──▶ live ──end──▶ ended
 *
 * The arrows point one way only. Ending a broadcast is what tears its channel
 * down, so "going live again" would put every viewer on a player pointed at a
 * resource that no longer exists — the second attempt is a new broadcast.
 *
 * **The stream key is deliberately not a prop.** It is the credential that lets
 * anyone broadcast as the station, and `LiveVideoPort` returns it once, at
 * provision time. Storing it here would put it in every database backup, every
 * studio API response and every log line that dumps a broadcast record; the
 * channel it protects is the station's own air.
 *
 * Every transition returns a new Broadcast. Nothing here mutates, and nothing
 * here reads the clock — the caller passes `now`, which is what makes "it ended
 * before it started" a rule a test can pin down.
 */
export class Broadcast {
  private constructor(private readonly props: BroadcastProps) {}

  /** Rebuild from storage. Applies no rules — the broadcast already existed. */
  static reconstitute(props: BroadcastProps): Broadcast {
    return new Broadcast(props)
  }

  /** The only way a Broadcast comes into existence. */
  static schedule(actor: Actor, input: NewBroadcast): Broadcast {
    requirePermission(actor, 'stream:manage')
    if (input.captionMode !== 'in_band') throw new LiveCaptionsRequired()

    return new Broadcast({
      ...input,
      state: 'scheduled',
      startedAt: null,
      endedAt: null,
      createdBy: actor.id,
    })
  }

  get id(): BroadcastId { return this.props.id }
  get title(): string { return this.props.title }
  get locale(): string { return this.props.locale }
  get state(): BroadcastState { return this.props.state }
  get channelArn(): string { return this.props.channelArn }
  get playbackUrl(): string { return this.props.playbackUrl }
  get captionMode(): LiveCaptionMode { return this.props.captionMode }
  get scheduledFor(): Date { return this.props.scheduledFor }
  get startedAt(): Date | null { return this.props.startedAt }
  get endedAt(): Date | null { return this.props.endedAt }
  get createdBy(): UserId { return this.props.createdBy }

  /**
   * Puts the broadcast on air.
   *
   * Guard order is permission, then state — the same order Article uses, for
   * the same reason: "you may not do this at all" outranks "you may not do this
   * *now*", and telling an unpermitted actor that a broadcast is already live
   * confirms the station is on air and since when.
   */
  goLive(actor: Actor, now: Date): Broadcast {
    requirePermission(actor, 'stream:manage')

    // Re-entering `live` would move startedAt forward, and elapsed-time is the
    // number the gallery reads off the studio screen mid-programme.
    if (this.props.state === 'live') throw new AlreadyLive(this.props.id)
    if (this.props.state === 'ended') throw new BroadcastHasEnded(this.props.id)

    return this.with({ state: 'live', startedAt: now })
  }

  /**
   * Takes the broadcast off air. Only a live one can end.
   *
   * Refusing from `scheduled` protects the setup window: ending is what tells
   * the application to tear the channel down, and doing that to a broadcast an
   * operator is still cabling up destroys the ingest they are about to use.
   */
  end(actor: Actor, now: Date): Broadcast {
    requirePermission(actor, 'stream:manage')

    if (this.props.state !== 'live') throw new NotLive(this.props.id, this.props.state)

    return this.with({ state: 'ended', endedAt: now })
  }

  /** Whether it is on air right now. Drives the public player and `currentLive`. */
  isLive(): boolean {
    return this.props.state === 'live'
  }

  private with(patch: Partial<BroadcastProps>): Broadcast {
    return new Broadcast({ ...this.props, ...patch })
  }

  snapshot(): BroadcastProps {
    return this.props
  }
}
