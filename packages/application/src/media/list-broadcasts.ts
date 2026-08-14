import { type Actor, type Broadcast, requirePermission } from '@kurasikapa/domain'
import type { BroadcastRepository } from '../ports/broadcast-repository'
import { clampLimit } from '../ports/pagination'
import type { UseCase } from '../ports/use-case'

export interface ListBroadcastsDeps {
  readonly broadcasts: BroadcastRepository
}

export interface ListBroadcastsInput {
  readonly actor: Actor
  readonly locale: string
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 25, max: 100 }

/**
 * The studio's broadcast list for one locale — schedule and history.
 *
 * Returns aggregates rather than the reader projection: an operator holding
 * `stream:manage` is the one audience that legitimately needs `channelArn`, to
 * reconcile a record against the AWS console. The permission check is what
 * makes that safe, which is exactly why it lives here and not in the studio
 * page — a page is one caller, this is the rule.
 *
 * No cursor: a station runs a handful of broadcasts a day, not an archive that
 * grows at the head, so a clamped limit is honest where paging would be
 * ceremony.
 */
export class ListBroadcasts implements UseCase<ListBroadcastsInput, readonly Broadcast[]> {
  constructor(private readonly deps: ListBroadcastsDeps) {}

  /**
   * `async` deliberately: `requirePermission` throws, and a synchronous throw
   * from a method typed `Promise<T>` escapes a caller's `.catch()`.
   */
  async execute(input: ListBroadcastsInput): Promise<readonly Broadcast[]> {
    requirePermission(input.actor, 'stream:manage')

    return this.deps.broadcasts.list(input.locale, clampLimit(input.limit, LIMITS))
  }
}
