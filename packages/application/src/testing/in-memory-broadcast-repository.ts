import type { Broadcast, BroadcastId } from '@kurasikapa/domain'
import type { BroadcastRepository } from '../ports/broadcast-repository'

/**
 * Hand-written, not generated and not auto-mocked.
 *
 * It answers `currentLive` from the aggregate's own `isLive()` rather than a
 * stored flag, so a use case that forgets to save an ended broadcast fails here
 * the way it would fail against Mongo — which is the whole point of a fake that
 * behaves rather than a mock that agrees.
 */
export class InMemoryBroadcastRepository implements BroadcastRepository {
  private readonly store = new Map<string, Broadcast>()

  constructor(seed: readonly Broadcast[] = []) {
    for (const broadcast of seed) this.store.set(broadcast.id, broadcast)
  }

  findById(id: BroadcastId): Promise<Broadcast | null> {
    return Promise.resolve(this.store.get(id) ?? null)
  }

  currentLive(locale: string): Promise<Broadcast | null> {
    const match = this.all().find((b) => b.locale === locale && b.isLive())
    return Promise.resolve(match ?? null)
  }

  list(locale: string, limit: number): Promise<readonly Broadcast[]> {
    const matches = this.all()
      .filter((b) => b.locale === locale)
      .sort(byNewestScheduled)

    return Promise.resolve(matches.slice(0, limit))
  }

  save(broadcast: Broadcast): Promise<void> {
    this.store.set(broadcast.id, broadcast)
    return Promise.resolve()
  }

  /** Test affordance — not part of the port. */
  count(): number {
    return this.store.size
  }

  private all(): Broadcast[] {
    return [...this.store.values()]
  }
}

/**
 * Saves fail; reads work.
 *
 * For asserting that a failed write does not leave a provisioned channel with
 * nothing pointing at it — the orphan that bills forever. Mirrors
 * ExplodingEventBus, which exists for the same class of question.
 */
export class ExplodingBroadcastRepository extends InMemoryBroadcastRepository {
  override save(): Promise<void> {
    return Promise.reject(new Error(STORE_UNAVAILABLE))
  }
}

/** Exported so an assertion matches the real string rather than a copy of it. */
export const STORE_UNAVAILABLE = 'broadcast store unavailable'

/**
 * `currentLive` hands back whatever it holds for the locale, live or not.
 *
 * Models the repository whose state predicate got dropped in a refactor — the
 * exact mistake GetCurrentBroadcast's second check exists to survive. Without a
 * fake that is allowed to be wrong, that guard can only be tested by trusting
 * it, which is the same as not testing it.
 */
export class UnfilteredBroadcastRepository extends InMemoryBroadcastRepository {
  constructor(private readonly rows: readonly Broadcast[]) {
    super(rows)
  }

  override currentLive(locale: string): Promise<Broadcast | null> {
    return Promise.resolve(this.rows.find((b) => b.locale === locale) ?? null)
  }
}

const byNewestScheduled = (a: Broadcast, b: Broadcast): number =>
  b.scheduledFor.getTime() - a.scheduledFor.getTime()
