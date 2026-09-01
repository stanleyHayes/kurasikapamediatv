import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { articleId } from '@kurasikapa/domain'
import { container } from '@kurasikapa/web-kit/composition/container'
import { isSupportedLocale } from '@kurasikapa/web-kit/i18n/routing'

const input = z.object({
  articleId: z.string().min(1).max(128), locale: z.string().min(2).max(8),
  visitorId: z.uuid(), scrollDepth: z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
  activeSeconds: z.number().int().min(0).max(3_600),
})

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = input.safeParse(await readJson(request))
  if (!parsed.success || !isSupportedLocale(parsed.data.locale)) {
    return NextResponse.json({ error: 'invalid_engagement' }, { status: 400 })
  }
  const visitorHash = createHash('sha256').update(parsed.data.visitorId).digest('hex')
  const verdict = await container().rateLimiter.consume(`engagement:${visitorHash}`, { limit: 240, windowSeconds: 3_600 })
  if (!verdict.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } })
  }
  try {
    await container().recordArticleEngagement.execute({
      articleId: articleId(parsed.data.articleId), locale: parsed.data.locale, visitorHash,
      scrollDepth: parsed.data.scrollDepth, activeSeconds: parsed.data.activeSeconds,
    })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'invalid_engagement' }, { status: 400 })
  }
}

async function readJson(request: Request): Promise<unknown> {
  try { return await request.json() } catch { return null }
}
