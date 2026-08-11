import { container } from '@/composition/container'
import { isAuthorisedCron } from '@/composition/cron-auth'
import { env } from '@/composition/env'

/**
 * The social fan-out cron.
 *
 * Sends queued Facebook/Instagram posts whose time has arrived. The adapter
 * is fail-closed: unset Meta credentials become per-post failures, which the
 * use case retries until the five-attempt budget is spent.
 *
 * Triggered by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`.
 */

export async function POST(request: Request): Promise<Response> {
  const secret = env().CRON_SECRET
  if (!isAuthorisedCron(request, secret)) {
    return new Response('Not found', { status: 404 })
  }

  const result = await container().publishDuePosts.execute()

  if (result.abandoned.length > 0) {
    console.error(
      JSON.stringify({
        event: 'publish_due_posts.abandoned',
        count: result.abandoned.length,
        abandoned: result.abandoned,
      }),
    )
  }

  return Response.json(result, { status: result.abandoned.length > 0 ? 207 : 200 })
}

export function GET(request: Request): Promise<Response> {
  return POST(request)
}
