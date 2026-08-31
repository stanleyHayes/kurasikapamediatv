import { ScheduleSlot, scheduleSlotId, type Actor, type ProgrammeId } from '@kurasikapa/domain'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { ProgrammeRepository } from '../ports/programme-repository'
import type { ScheduleRepository } from '../ports/schedule-repository'
import type { UseCase } from '../ports/use-case'
import { ProgrammeNotFound, UnpublishedProgramme } from './programme-errors'

export interface ScheduleProgrammeDeps {
  readonly programmes: ProgrammeRepository; readonly schedule: ScheduleRepository
  readonly clock: ClockPort; readonly ids: IdPort
}
export interface ScheduleProgrammeInput {
  readonly actor: Actor; readonly programmeId: ProgrammeId; readonly locale: string
  readonly startsAt: Date; readonly endsAt: Date; readonly isLive: boolean
}

export class ScheduleProgramme implements UseCase<ScheduleProgrammeInput, ScheduleSlot> {
  constructor(private readonly deps: ScheduleProgrammeDeps) {}

  async execute(input: ScheduleProgrammeInput): Promise<ScheduleSlot> {
    const programme = await this.deps.programmes.findById(input.programmeId)
    if (programme === null) throw new ProgrammeNotFound(input.programmeId)
    if (!programme.published) throw new UnpublishedProgramme(input.programmeId)
    const slot = ScheduleSlot.schedule(input.actor, {
      id: scheduleSlotId(this.deps.ids.next()), programmeId: input.programmeId, locale: input.locale,
      startsAt: input.startsAt, endsAt: input.endsAt, isLive: input.isLive,
    }, this.deps.clock.now())
    await this.deps.schedule.save(slot)
    return slot
  }
}
