import { container } from '@kurasikapa/web-kit/composition/container'
import { isAuthorisedCron } from '@kurasikapa/web-kit/composition/cron-auth'
import { env } from '@kurasikapa/web-kit/composition/env'
import { systemActor } from '@kurasikapa/web-kit/composition/system-actor'

/**
 * Pulls registered RSS feeds into drafts. A fetch failure skips that source.
 * Triggered by Vercel Cron with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = env().CRON_SECRET
  if (!isAuthorisedCron(request, secret)) {
    return new Response('Not found', { status: 404 })
  }

  const result = await container().ingestRssFeeds.execute({ actor: systemActor() })
  return Response.json(result)
}

export function GET(request: Request): Promise<Response> {
  return POST(request)
}
