import { publishDueViaApi } from '@/bff/publish-due'
import { announcePublished } from '@/composition/announce-published'
import { container } from '@/composition/container'
import { isAuthorisedCron } from '@/composition/cron-auth'
import { env } from '@/composition/env'
import { systemActor } from '@/composition/system-actor'

/**
 * The scheduled-publication cron.
 *
 * When `API_URL` is set, delegates to Go `/internal/publish-due` (ADR-0009) and
 * announces each success onto Next's event bus for cache + audit. Otherwise
 * keeps the in-process TypeScript path.
 *
 * Triggered by Vercel Cron (see vercel.json) with
 * `Authorization: Bearer $CRON_SECRET`.
 */

export async function POST(request: Request): Promise<Response> {
  const secret = env().CRON_SECRET
  if (!isAuthorisedCron(request, secret)) {
    return new Response('Not found', { status: 404 })
  }

  const result = await runPublishDue(secret)

  if (result.failed.length > 0) {
    console.error(
      JSON.stringify({
        event: 'publish_due.failed',
        count: result.failed.length,
        failures: result.failed,
      }),
    )
  }

  return Response.json(
    { published: result.published, failed: result.failed },
    { status: result.failed.length > 0 ? 207 : 200 },
  )
}

export function GET(request: Request): Promise<Response> {
  return POST(request)
}

async function runPublishDue(secret: string | undefined): Promise<{
  published: readonly string[] | readonly { id: string; slug: string; locale: string }[]
  failed: readonly { articleId: string; reason: string }[]
}> {
  const apiUrl = env().API_URL

  if (apiUrl !== undefined && secret !== undefined) {
    const result = await publishDueViaApi({ baseUrl: apiUrl, cronSecret: secret })
    const system = systemActor()

    for (const item of result.published) {
      await announcePublished({
        articleId: item.id,
        slug: item.slug,
        locale: item.locale,
        actorId: system.id,
      })
    }

    return {
      published: result.published.map((item) => item.id),
      failed: result.failed,
    }
  }

  const result = await container().publishDueArticles.execute({ actor: systemActor() })

  return {
    published: result.published,
    failed: result.failed,
  }
}
