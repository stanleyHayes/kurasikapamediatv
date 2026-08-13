import type { CacheTags } from './cache-invalidation'

/**
 * Cache invalidation that crosses a deployment boundary.
 *
 * Next's cache tags are scoped to ONE deployment's cache. Every `cacheTag()`
 * in read-model/queries.ts is read by apps/web; every publish that invalidates
 * one happens in apps/studio. So after the split, a studio `updateTag()`
 * refreshes the studio's cache — which caches nothing a reader ever sees — and
 * the public article stays stale until its `cacheLife` expires.
 *
 * That is a silent failure of the loudest kind: publishing appears to work,
 * the database is correct, and the site does not change.
 *
 * So the studio tells the site instead, over HTTP, and the site applies the
 * tags to its own cache. One extra hop on publish, in exchange for the promise
 * still holding.
 *
 * The wire format is a list of tag names and nothing else. `invalidateFor`
 * still distinguishes urgent (`update`) from background (`revalidate`), but
 * that distinction was about `updateTag` vs `revalidateTag` — read-your-own-
 * writes within a single request. The request that publishes is on another
 * deployment now, so there is no reader here whose own write could be read.
 * Sending a mode the receiver cannot act on would be dead data on the wire.
 */
export const REVALIDATE_TIMEOUT_MS = 5_000

export class RevalidationNotConfigured extends Error {
  constructor() {
    super(
      'REVALIDATE_SECRET is unset, so a publish cannot refresh the public site. ' +
        'Set it on BOTH deployments. See ADR-0011.',
    )
    this.name = 'RevalidationNotConfigured'
  }
}

export class RevalidationRejected extends Error {
  constructor(status: number) {
    super(`The site refused a revalidation request with ${String(status)}.`)
    this.name = 'RevalidationRejected'
  }
}

/**
 * A `CacheTags` that records instead of acting.
 *
 * Lets `invalidateFor` stay exactly as it was — it still decides which tags an
 * event touches — while the doing moves across the wire. Deduplicated: an
 * event that touches a tag twice is one invalidation, not two round trips.
 */
export function collectingTags(): { tags: CacheTags; drain: () => string[] } {
  const collected = new Set<string>()
  const add = (tag: string): void => {
    collected.add(tag)
  }

  return {
    tags: { update: add, revalidate: add },
    drain: () => {
      const drained = [...collected]
      collected.clear()

      return drained
    },
  }
}

/**
 * Posts the drained tags to the public site.
 *
 * THROWS when it cannot deliver — it does not swallow. The caller is an event
 * subscriber, and the event bus collects and reports subscriber failures
 * without failing the action that raised them. That is the right shape here for
 * the same reason it is right for the audit log: the article really was
 * published, so refusing to acknowledge it would tell an editor to publish
 * twice. But a stale public site must not be invisible either.
 */
export async function postInvalidations(input: {
  readonly siteUrl: string
  readonly secret: string | undefined
  readonly tags: readonly string[]
  readonly fetchImpl?: typeof fetch
  readonly timeoutMs?: number
}): Promise<void> {
  if (input.tags.length === 0) return
  if (input.secret === undefined || input.secret === '') throw new RevalidationNotConfigured()

  const send = input.fetchImpl ?? fetch
  const response = await send(`${input.siteUrl}/api/revalidate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.secret}`,
    },
    body: JSON.stringify({ tags: input.tags }),
    // Never a cached response: this is a command, and a cached 200 would mean
    // the second publish of the day silently did nothing.
    cache: 'no-store',
    /*
     * Bounded, because an editor is waiting on it.
     *
     * This is awaited inside the publish Server Action. Without a deadline an
     * unresponsive or half-open site connection hangs the publish button for
     * as long as the platform allows — turning "the site did not refresh" into
     * "publishing is broken", which is far worse. Timing out surfaces the same
     * reported failure as any other delivery problem.
     */
    signal: AbortSignal.timeout(input.timeoutMs ?? REVALIDATE_TIMEOUT_MS),
  })

  if (!response.ok) throw new RevalidationRejected(response.status)
}

/**
 * Narrows an untrusted request body to the tags we are willing to act on.
 *
 * Total on any input. The body arrives over the network and `request.json()`
 * happily returns `null`, a string or an array — none of which have the shape
 * this claims to read.
 */
export function parseInvalidations(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) return []

  const list = (body as { tags?: unknown }).tags
  if (!Array.isArray(list)) return []

  return list.filter((tag): tag is string => typeof tag === 'string' && tag !== '')
}
