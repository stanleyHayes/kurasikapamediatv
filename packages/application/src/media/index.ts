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

export { AlreadyBroadcasting, BroadcastNotFound, LiveVideoUnavailable } from './errors'
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
