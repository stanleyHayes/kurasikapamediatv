import type { Presenter, Programme, ScheduleSlot } from '@kurasikapa/domain'
import type { PresenterRepository } from '../ports/presenter-repository'
import type { ProgrammeRepository } from '../ports/programme-repository'
import type { ScheduleRepository } from '../ports/schedule-repository'
import type { UseCase } from '../ports/use-case'

export interface TelevisionProgramme { readonly programme: Programme; readonly presenters: readonly Presenter[] }
export interface TelevisionSlot { readonly slot: ScheduleSlot; readonly programme: Programme }
export interface TelevisionGuide {
  readonly presenters: readonly Presenter[]
  readonly programmes: readonly TelevisionProgramme[]
  readonly upcoming: readonly TelevisionSlot[]
  readonly replays: readonly TelevisionSlot[]
}
export interface ListTelevisionGuideInput { readonly locale: string; readonly from: Date }
export interface ListTelevisionGuideDeps {
  readonly presenters: PresenterRepository; readonly programmes: ProgrammeRepository
  readonly schedule: ScheduleRepository
}

export class ListTelevisionGuide implements UseCase<ListTelevisionGuideInput, TelevisionGuide> {
  constructor(private readonly deps: ListTelevisionGuideDeps) {}

  async execute(input: ListTelevisionGuideInput): Promise<TelevisionGuide> {
    const [presenters, programmes, upcoming, replays] = await Promise.all([
      this.deps.presenters.listPublished(input.locale), this.deps.programmes.listPublished(input.locale),
      this.deps.schedule.listUpcoming(input.locale, input.from, 20), this.deps.schedule.listReplays(input.locale, 12),
    ])
    const presenterById = new Map(presenters.map((item) => [item.id, item]))
    const programmeById = new Map(programmes.map((item) => [item.id, item]))
    const enrich = (slots: readonly ScheduleSlot[]): TelevisionSlot[] => slots.flatMap((slot) => {
      const programme = programmeById.get(slot.programmeId)
      return programme === undefined ? [] : [{ slot, programme }]
    })
    return {
      presenters,
      programmes: programmes.map((programme) => ({
        programme,
        presenters: programme.presenterIds.flatMap((id) => {
          const presenter = presenterById.get(id)
          return presenter === undefined ? [] : [presenter]
        }),
      })),
      upcoming: enrich(upcoming),
      replays: enrich(replays),
    }
  }
}
