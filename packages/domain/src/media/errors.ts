import type { BroadcastId } from '../shared/ids'
import type { BroadcastState } from './broadcast-state'

export class AlreadyLive extends Error {
  constructor(readonly broadcastId: BroadcastId) {
    super(`Broadcast ${broadcastId} is already live`)
    this.name = 'AlreadyLive'
  }
}

/**
 * Ending a broadcast tears its channel down, so an ended one cannot be revived:
 * `channelArn` names a resource that no longer exists. A second attempt at the
 * same programme is a new broadcast against a new channel.
 */
export class BroadcastHasEnded extends Error {
  constructor(readonly broadcastId: BroadcastId) {
    super(`Broadcast ${broadcastId} has ended; start a new one`)
    this.name = 'BroadcastHasEnded'
  }
}

export class NotLive extends Error {
  constructor(
    readonly broadcastId: BroadcastId,
    readonly state: BroadcastState,
  ) {
    super(`Broadcast ${broadcastId} is "${state}", not live, and cannot be ended`)
    this.name = 'NotLive'
  }
}
