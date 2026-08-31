import {
  EndBroadcast,
  GetCurrentBroadcast,
  ListBroadcasts,
  StartBroadcast,
  CreatePresenter,
  PublishPresenter,
  CreateProgramme,
  PublishProgramme,
  ScheduleProgramme,
  ListTelevisionGuide,
  type BroadcastRepository,
  type ClockPort,
  type IdPort,
  type LiveVideoPort,
  type PresenterRepository,
  type ProgrammeRepository,
  type ScheduleRepository,
} from '@kurasikapa/application'

export interface MediaCommands {
  readonly startBroadcast: StartBroadcast
  readonly endBroadcast: EndBroadcast
  readonly getCurrentBroadcast: GetCurrentBroadcast
  readonly listBroadcasts: ListBroadcasts
  readonly createPresenter: CreatePresenter
  readonly publishPresenter: PublishPresenter
  readonly createProgramme: CreateProgramme
  readonly publishProgramme: PublishProgramme
  readonly scheduleProgramme: ScheduleProgramme
  readonly listTelevisionGuide: ListTelevisionGuide
}

/**
 * The media context's use cases, wired over one repository and one provider —
 * the same shape as `rssCommands`, and separate from `build-container.ts` for
 * the same reason: that file is a list of contexts, not a list of constructors.
 *
 * `live` is required here, not optional. The decision about what to do when no
 * provider is configured belongs at the composition root, which substitutes the
 * fail-closed adapter; making it optional down here would put a second answer
 * to that question in a second place, and the two would drift.
 *
 * `GetCurrentBroadcast` takes no provider and no clock. It is the reader-facing
 * "are we on air?" lookup that the public homepage runs on every request, and
 * keeping it on the repository alone is what stops an unconfigured deployment's
 * front page from depending on AWS to render.
 */
export function mediaCommands(input: {
  readonly broadcasts: BroadcastRepository
  readonly live: LiveVideoPort
  readonly clock: ClockPort
  readonly ids: IdPort
  readonly presenters: PresenterRepository
  readonly programmes: ProgrammeRepository
  readonly schedule: ScheduleRepository
}): MediaCommands {
  const { broadcasts, live, clock, ids, presenters, programmes, schedule } = input

  return {
    startBroadcast: new StartBroadcast({ broadcasts, live, clock, ids }),
    endBroadcast: new EndBroadcast({ broadcasts, live, clock }),
    getCurrentBroadcast: new GetCurrentBroadcast({ broadcasts }),
    listBroadcasts: new ListBroadcasts({ broadcasts }),
    createPresenter: new CreatePresenter({ presenters, ids }),
    publishPresenter: new PublishPresenter({ presenters }),
    createProgramme: new CreateProgramme({ presenters, programmes, ids }),
    publishProgramme: new PublishProgramme({ presenters, programmes }),
    scheduleProgramme: new ScheduleProgramme({ programmes, schedule, clock, ids }),
    listTelevisionGuide: new ListTelevisionGuide({ presenters, programmes, schedule }),
  }
}
