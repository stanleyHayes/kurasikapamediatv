import { type Actor, requirePermission } from '../identity/actor'
import type { AssetId, ProgrammeId, ScheduleSlotId, UserId } from '../shared/ids'

export type ScheduleSlotState = 'scheduled' | 'cancelled' | 'completed'

export interface ScheduleSlotProps {
  readonly id: ScheduleSlotId
  readonly programmeId: ProgrammeId
  readonly locale: string
  readonly startsAt: Date
  readonly endsAt: Date
  readonly isLive: boolean
  readonly state: ScheduleSlotState
  readonly replayAssetId: AssetId | null
  readonly captionAssetId: AssetId | null
  readonly createdBy: UserId
}

export type NewScheduleSlot = Omit<
  ScheduleSlotProps,
  'state' | 'replayAssetId' | 'captionAssetId' | 'createdBy'
>

export class ScheduleSlotInPast extends Error {}
export class InvalidScheduleWindow extends Error {}
export class SlotAlreadyCancelled extends Error {}
export class ReplayNeedsCaptions extends Error {}

/** One public airing of a recurring programme, optionally linked to its replay. */
export class ScheduleSlot {
  private constructor(private readonly props: ScheduleSlotProps) {}

  static schedule(actor: Actor, input: NewScheduleSlot, now: Date): ScheduleSlot {
    requirePermission(actor, 'stream:manage')
    if (input.startsAt.getTime() <= now.getTime()) throw new ScheduleSlotInPast()
    if (input.endsAt.getTime() <= input.startsAt.getTime()) throw new InvalidScheduleWindow()

    return new ScheduleSlot({
      ...input,
      state: 'scheduled',
      replayAssetId: null,
      captionAssetId: null,
      createdBy: actor.id,
    })
  }

  static reconstitute(props: ScheduleSlotProps): ScheduleSlot {
    return new ScheduleSlot(props)
  }

  get id(): ScheduleSlotId { return this.props.id }
  get programmeId(): ProgrammeId { return this.props.programmeId }
  get locale(): string { return this.props.locale }
  get startsAt(): Date { return this.props.startsAt }
  get endsAt(): Date { return this.props.endsAt }
  get isLive(): boolean { return this.props.isLive }
  get state(): ScheduleSlotState { return this.props.state }
  get replayAssetId(): AssetId | null { return this.props.replayAssetId }
  get captionAssetId(): AssetId | null { return this.props.captionAssetId }

  cancel(actor: Actor): ScheduleSlot {
    requirePermission(actor, 'stream:manage')
    if (this.props.state === 'cancelled') throw new SlotAlreadyCancelled()
    return this.with({ state: 'cancelled' })
  }

  publishReplay(actor: Actor, replayAssetId: AssetId, captionAssetId: AssetId | null): ScheduleSlot {
    requirePermission(actor, 'stream:manage')
    if (captionAssetId === null) throw new ReplayNeedsCaptions()
    return this.with({ state: 'completed', replayAssetId, captionAssetId })
  }

  snapshot(): ScheduleSlotProps {
    return this.props
  }

  private with(patch: Partial<ScheduleSlotProps>): ScheduleSlot {
    return new ScheduleSlot({ ...this.props, ...patch })
  }
}
