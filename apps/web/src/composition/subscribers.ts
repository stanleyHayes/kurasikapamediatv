import type { AuditLog, IdPort } from '@kurasikapa/application'
import { auditEntryFor } from '@kurasikapa/application'
import { revalidateTag, updateTag } from 'next/cache'
import { type CacheTags, invalidateFor } from './cache-invalidation'
import type { InProcessEventBus } from './ambient'

/**
 * Must match the `cacheLife` on the listing queries in read-model/queries.ts.
 * Next 16 requires the profile here, and a mismatch would give the rails a
 * different freshness after a publish than they have the rest of the time.
 */
const LISTING_PROFILE = 'minutes'

const nextTags: CacheTags = {
  /**
   * `updateTag` is Server-Action-only; Next throws everywhere else and says so.
   *
   * The same publish happens from two places: an editor's Server Action, where
   * an in-request update is what makes breaking news live within the request,
   * and the cron route handler, where there is no reader waiting on this
   * response and nothing to update in-request.
   *
   * There is no API to ask which context we are in, so the attempt IS the
   * question and the fallback is the answer. Falling back to `revalidateTag`
   * rather than rethrowing is correct on the merits: the cron's job is to make
   * the article live, and it has.
   */
  update: (tag) => {
    try {
      updateTag(tag)
    } catch {
      revalidateTag(tag, LISTING_PROFILE)
    }
  },
  revalidate: (tag) => {
    revalidateTag(tag, LISTING_PROFILE)
  },
}

/**
 * Registered once, on the production graph only.
 *
 * Attaching these to the event bus rather than to the Server Action means the
 * scheduled-publication cron invalidates and audits exactly the same way an
 * editor's click does. Wiring them into the action would have left scheduled
 * articles live in the database, stale on the site, and absent from the record.
 */
export function registerSubscribers(events: InProcessEventBus, audit: AuditLog, ids: IdPort): void {
  events.on((event) => {
    invalidateFor(nextTags, event)
    return Promise.resolve()
  })

  // Audit every event, not a chosen few. Deciding here which actions are
  // "worth recording" is how the one action somebody later needs turns out to
  // be the one nobody kept.
  //
  // A failing audit write does NOT fail the action that caused it: the thing
  // already happened, and refusing to acknowledge a publication because the
  // log was unreachable would tell an editor to publish twice. The event bus
  // collects and reports subscriber failures — see EventBusPort.
  events.on(async (event) => {
    await audit.append(auditEntryFor(event, ids.next()))
  })
}
