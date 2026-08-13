import { revalidateTag } from 'next/cache'
import { isAuthorisedCron } from '@kurasikapa/web-kit/composition/cron-auth'
import { env } from '@kurasikapa/web-kit/composition/env'
import { parseInvalidations } from '@kurasikapa/web-kit/composition/revalidation'

/**
 * The cache-life profile to revalidate a tag under.
 *
 * `revalidateTag` requires one, and it has to describe the entries actually
 * carrying that tag — which live in read-model/queries.ts, in THIS app. That
 * is why the choice is made here rather than sent over the wire: the studio
 * does not know, and should not need to know, how long the site caches things.
 *
 * `article-{id}` is attached by three queries with three different lifetimes:
 * `cachedRelated` (minutes), `cachedArticle` (hours) and `cachedTakeaways`
 * (days). Where one tag spans several, take the LONGEST. The two errors are not
 * symmetric: a marker that outlives its entries costs a redundant rebuild,
 * while a marker that expires first leaves the longest-lived entry serving the
 * pre-publish text with nothing left to invalidate it.
 *
 * Keep this in step with queries.ts. A cacheLife raised there and not here is
 * the shape of bug that only shows up as "one reader still sees the old
 * headline".
 */
function profileFor(tag: string): string {
  return tag.startsWith('article-') ? 'days' : 'minutes'
}

/**
 * The public site's cache, refreshed on the studio's behalf.
 *
 * Next scopes cache tags to a single deployment. Since the studio became its
 * own deployment (ADR-0011) it can no longer invalidate the tags its publishes
 * affect — every one of them belongs to this app's cache. So it posts them
 * here and this route applies them locally.
 *
 * `revalidateTag`, not `updateTag`: `updateTag` only exists inside a Server
 * Action, and more to the point it means "refresh within THIS request". The
 * request that published is on another deployment entirely, so there is no
 * reader here to serve fresh content to. Invalidating now means the next
 * reader request rebuilds — which is what "live immediately" means once the
 * publisher and the reader are on different machines.
 */
export async function POST(request: Request): Promise<Response> {
  // Same bearer-secret mechanism as the cron routes, and the same fail-closed
  // rule: unset means refuse. An endpoint that can flush the whole article
  // cache must not fall open because someone forgot an environment variable.
  if (!isAuthorisedCron(request, env().REVALIDATE_SECRET)) {
    return new Response('Not found', { status: 404 })
  }

  const tags = parseInvalidations(await readJson(request))
  for (const tag of tags) {
    revalidateTag(tag, profileFor(tag))
  }

  // Reports what it acted on, not what it was sent: a caller that mistypes a
  // payload should see zero, not a cheerful 200 that hid the typo.
  return Response.json({ revalidated: tags })
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
