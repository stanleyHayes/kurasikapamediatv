/**
 * The media context's public surface.
 *
 * A per-context barrel because the package barrel is at its 250-line ceiling and
 * one more context's worth of names would fail the build on an export list
 * rather than on anything real. Media names are added here; `src/index.ts` keeps
 * its single line.
 *
 * The two live ports are re-exported from here as well: they live under
 * `src/ports/` with every other port, but they are media's ports, and a consumer
 * looking for them should not have to know which directory they sit in.
 */
export type { BroadcastRepository } from '../ports/broadcast-repository'
export type {
  LiveVideoPort,
  ProvisionChannelInput,
  ProvisionedChannel,
} from '../ports/live-video'

export { AlreadyBroadcasting, BroadcastNotFound, CleanupRequired, LiveVideoUnavailable } from './errors'
export {
  StartBroadcast,
  type StartBroadcastDeps,
  type StartBroadcastInput,
  type StartBroadcastResult,
} from './start-broadcast'
export {
  EndBroadcast,
  type EndBroadcastDeps,
  type EndBroadcastInput,
  type EndBroadcastResult,
} from './end-broadcast'
export {
  GetCurrentBroadcast,
  type GetCurrentBroadcastDeps,
  type GetCurrentBroadcastInput,
  type LiveBroadcast,
} from './get-current-broadcast'
export {
  ListBroadcasts,
  type ListBroadcastsDeps,
  type ListBroadcastsInput,
} from './list-broadcasts'
export type { PresenterRepository } from '../ports/presenter-repository'
export type { ProgrammeRepository } from '../ports/programme-repository'
export type { ScheduleRepository } from '../ports/schedule-repository'
export { CreatePresenter, type CreatePresenterDeps, type CreatePresenterInput } from './create-presenter'
export { PublishPresenter, type PublishPresenterInput } from './publish-presenter'
export { CreateProgramme, type CreateProgrammeDeps, type CreateProgrammeInput } from './create-programme'
export { PublishProgramme, type PublishProgrammeDeps, type PublishProgrammeInput } from './publish-programme'
export { ScheduleProgramme, type ScheduleProgrammeDeps, type ScheduleProgrammeInput } from './schedule-programme'
export {
  ListTelevisionGuide,
  type ListTelevisionGuideDeps,
  type ListTelevisionGuideInput,
  type TelevisionGuide,
  type TelevisionProgramme,
  type TelevisionSlot,
} from './list-television-guide'
export { ProgrammeNotFound, PresenterNotFound, UnpublishedPresenter, UnpublishedProgramme } from './programme-errors'
