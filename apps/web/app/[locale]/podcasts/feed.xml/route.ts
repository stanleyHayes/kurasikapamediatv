import { loadPodcasts } from '@kurasikapa/web-kit/bff/podcasts'
import { podcastRssXml } from '@/syndication/podcast-rss'

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }): Promise<Response> {
  const { locale } = await params
  const podcasts = await loadPodcasts(locale)
  const origin = process.env['APP_URL'] ?? 'https://kurasikapa-web.vercel.app'
  const body = podcastRssXml(podcasts, locale, origin)
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } })
}
