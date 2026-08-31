import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ACQUISITION_CHANNELS, articleId } from '@kurasikapa/domain'
import { container } from '@kurasikapa/web-kit/composition/container'
import { isSupportedLocale } from '@kurasikapa/web-kit/i18n/routing'

const input = z.object({
  articleId: z.string().min(1).max(128), locale: z.string().min(2).max(8),
  visitorId: z.uuid(), channel: z.enum(ACQUISITION_CHANNELS),
})

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = input.safeParse(await readJson(request))
  if (!parsed.success || !isSupportedLocale(parsed.data.locale)) return NextResponse.json({ error: 'invalid_view' }, { status: 400 })
  const visitorHash = createHash('sha256').update(parsed.data.visitorId).digest('hex')
  const verdict = await container().rateLimiter.consume(`analytics:${visitorHash}`, { limit: 120, windowSeconds: 3600 })
  if (!verdict.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } })
  try {
    await container().recordPageView.execute({ articleId: articleId(parsed.data.articleId), locale: parsed.data.locale, visitorHash, channel: parsed.data.channel })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'invalid_view' }, { status: 400 })
  }
}

async function readJson(request: Request): Promise<unknown> {
  try { return await request.json() } catch { return null }
}
