import { processSemanticIndex } from '@kurasikapa/web-kit/bff/semantic'
import { isAuthorisedCron } from '@kurasikapa/web-kit/composition/cron-auth'
import { env } from '@kurasikapa/web-kit/composition/env'

export async function POST(request: Request): Promise<Response> {
  const { API_URL: apiUrl, CRON_SECRET: secret } = env()
  if (!isAuthorisedCron(request, secret)) return new Response('Not found', { status: 404 })
  if (apiUrl === undefined || secret === undefined) {
    return Response.json({ error: 'Semantic indexing is not configured' }, { status: 503 })
  }
  return Response.json(await processSemanticIndex({ baseUrl: apiUrl, cronSecret: secret }))
}

export function GET(request: Request): Promise<Response> { return POST(request) }
