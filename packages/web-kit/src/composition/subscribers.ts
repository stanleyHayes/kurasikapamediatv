import type { AuditLog, IdPort } from '@kurasikapa/application'
import { auditEntryFor } from '@kurasikapa/application'
import { invalidateFor } from './cache-invalidation'
import { env } from './env'
import { siteUrl } from './origins'
import { collectingTags, postInvalidations } from './revalidation'
import type { InProcessEventBus } from './ambient'

/**
 * Registered once, on the production graph only.
 *
 * Attaching these to the event bus rather than to the Server Action means the
 * scheduled-publication cron invalidates and audits exactly the same way an
 * editor's click does. Wiring them into the action would have left scheduled
 * articles live in the database, stale on the site, and absent from the record.
 */
export function registerSubscribers(events: InProcessEventBus, audit: AuditLog, ids: IdPort): void {
  /*
   * Invalidation goes over the wire, not through `next/cache` directly.
   *
   * Every tag that matters is held by the PUBLIC site's cache, and since the
   * split every publish happens in the STUDIO. Next scopes cache tags to one
   * deployment, so a local `updateTag` here would refresh a cache no reader
   * reads. See revalidation.ts.
   *
   * Unconditional rather than "remote only when I am the studio": the site
   * emits no event `invalidateFor` acts on — publishing is newsroom-only — so
   * the branch would exist solely to describe a case that never happens.
   */
  events.on(async (event) => {
    const { tags, drain } = collectingTags()
    invalidateFor(tags, event)

    await postInvalidations({
      siteUrl: siteUrl(env()),
      secret: env().REVALIDATE_SECRET,
      tags: drain(),
    })
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
