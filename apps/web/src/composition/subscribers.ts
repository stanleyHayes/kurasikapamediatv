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
  update: (tag) => {
    updateTag(tag)
  },
  revalidate: (tag) => {
    revalidateTag(tag, LISTING_PROFILE)
  },
}

/**
 * Registered once, on the production graph only.
 *
 * Attaching cache invalidation to the event bus rather than to the Server
 * Action means the scheduled-publication cron invalidates exactly the same way
 * an editor's click does. Wiring it into the action would have left scheduled
 * articles live in the database and stale on the site.
 */
export function registerSubscribers(events: InProcessEventBus): void {
  events.on((event) => {
    invalidateFor(nextTags, event)
    return Promise.resolve()
  })
}
