import { processRecordingsViaApi } from '@kurasikapa/web-kit/bff/article-narration'
import { isAuthorisedCron } from '@kurasikapa/web-kit/composition/cron-auth'
import { env } from '@kurasikapa/web-kit/composition/env'

export async function POST(request: Request): Promise<Response> {
  const { API_URL: apiUrl, CRON_SECRET: secret } = env()
  if (!isAuthorisedCron(request, secret)) return new Response('Not found', { status: 404 })
  if (apiUrl === undefined || secret === undefined) {
    return Response.json({ error: 'Recording processing is not configured' }, { status: 503 })
  }

  const result = await processRecordingsViaApi({ baseUrl: apiUrl, cronSecret: secret })
  return Response.json(result)
}

export function GET(request: Request): Promise<Response> {
  return POST(request)
}
