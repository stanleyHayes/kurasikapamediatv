import { container } from '@/composition/container'
import { isAuthorisedCron } from '@/composition/cron-auth'
import { env } from '@/composition/env'
import { systemActor } from '@/composition/system-actor'

/**
 * The scheduled-publication cron.
 *
 * Until this existed, `SchedulePublication` wrote a promise the system never
 * kept: an editor could schedule an article for Tuesday and it would sit in
 * `scheduled` forever, because nothing ever asked which articles were due.
 * That is the bug this route closes.
 *
 * Triggered by Vercel Cron (see vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`.
 */

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorisedCron(request, env().CRON_SECRET)) {
    // 404, not 401. An unauthenticated caller learns nothing about whether a
    // scheduling endpoint exists here at all.
    return new Response('Not found', { status: 404 })
  }

  const result = await container().publishDueArticles.execute({ actor: systemActor() })

  // A non-empty `failed` is reported, never swallowed. One article failing must
  // not strand the batch — but an operator who cannot see which ones failed
  // cannot act, and a scheduled article quietly never going live is the worst
  // outcome available to a newsroom.
  //
  // Logged as well as returned. Vercel Cron only sees the status code; nobody
  // reads the response body of a scheduled invocation, so the body alone would
  // make this a failure that is technically reported and practically invisible.
  // console.error, not a logging framework: none has been chosen, and picking
  // one by side effect in a cron route is not the way to choose it.
  if (result.failed.length > 0) {
    console.error(
      JSON.stringify({
        event: 'publish_due.failed',
        count: result.failed.length,
        failures: result.failed,
      }),
    )
  }

  const body = {
    published: result.published,
    failed: result.failed,
  }

  // 207 when some failed: the run did happen, and a flat 200 would let an
  // uptime check call a half-failed publication healthy.
  return Response.json(body, { status: result.failed.length > 0 ? 207 : 200 })
}

/**
 * Vercel Cron issues GET, not POST.
 *
 * Kept as a thin delegate rather than the primary verb: publishing is not a
 * safe, idempotent read, and anything that follows links or prefetches must
 * never trigger it by accident. The secret is what actually stops that; the
 * verb choice is the belt to its braces.
 */
export function GET(request: Request): Promise<Response> {
  return POST(request)
}
