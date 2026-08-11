import { systemClock } from '@/composition/ambient'
import { env } from '@/composition/env'
import { cachedLatest } from '@/read-model/queries'
import { rssXml } from '@/syndication/rss'

/**
 * Public RSS for one locale. Cached list, same tag as the homepage rail, so a
 * publish invalidates the feed in the same request.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ locale: string }> },
): Promise<Response> {
  const { locale } = await context.params
  const { items } = await cachedLatest(locale, 50)
  const xml = rssXml({
    title: 'Kurasikapa Media TV',
    home: env().APP_URL,
    builtAt: systemClock.now(),
    items,
  })

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
