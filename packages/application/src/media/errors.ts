import type { BroadcastId } from '@kurasikapa/domain'

export class BroadcastNotFound extends Error {
  constructor(readonly broadcastId: BroadcastId) {
    super(`Broadcast ${broadcastId} not found`)
    this.name = 'BroadcastNotFound'
  }
}

/**
 * One locale, one transmission at a time.
 *
 * `BroadcastRepository.currentLive` is singular, so a second live broadcast in
 * the same locale would make "what does the front page play?" a coin toss — and
 * would leave a second IVS channel billing that nobody is watching.
 */
export class AlreadyBroadcasting extends Error {
  constructor(
    readonly locale: string,
    readonly broadcastId: BroadcastId,
  ) {
    super(`Locale "${locale}" is already broadcasting (${broadcastId})`)
    this.name = 'AlreadyBroadcasting'
  }
}

/**
 * The provider behind `LiveVideoPort` cannot serve this deployment.
 *
 * Its own class, not a bare `Error`, because of where it surfaces. ADR-0012
 * makes `disabled` the default, so "no provider configured" is the **normal**
 * state of a fresh checkout, a preview deployment and CI — and the studio's
 * error plumbing rethrows anything it does not recognise, which would turn the
 * expected state into a 500 and an operator reading "Something went wrong."
 *
 * Recognised, it becomes a sentence in the Go-live form naming the variable to
 * set. The message is written by the adapter; it must never carry a credential,
 * because this one is rendered.
 */
export class LiveVideoUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LiveVideoUnavailable'
  }
}
