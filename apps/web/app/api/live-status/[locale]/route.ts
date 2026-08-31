import { NextResponse } from 'next/server'
import { container } from '@kurasikapa/web-kit/composition/container'
import { isSupportedLocale } from '@kurasikapa/web-kit/i18n/routing'
import { LIVE_STATUS_CACHE_CONTROL, liveStatusProjection } from '@/live/status-projection'

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }): Promise<NextResponse> {
  const { locale } = await params
  if (!isSupportedLocale(locale)) return NextResponse.json({ error: 'unsupported_locale' }, { status: 404 })
  const current = await container().getCurrentBroadcast.execute({ locale })
  return NextResponse.json(liveStatusProjection(current), {
    headers: { 'Cache-Control': LIVE_STATUS_CACHE_CONTROL },
  })
}
