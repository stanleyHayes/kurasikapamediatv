const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1_000

export interface NewsSitemapItem {
  readonly locale: string
  readonly slug: string
  readonly title: string
  readonly publishedAt: string | null
}

export function recentNewsItems(items: readonly NewsSitemapItem[], now: Date): readonly NewsSitemapItem[] {
  const cutoff = now.getTime() - TWO_DAYS_MS
  return items.filter((item) => {
    if (item.publishedAt === null) return false
    const timestamp = new Date(item.publishedAt).getTime()
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now.getTime()
  })
}

export function buildNewsSitemap(items: readonly NewsSitemapItem[], baseUrl: string): string {
  const urls = items.map((item) => `<url>
  <loc>${xml(`${baseUrl}/${item.locale}/articles/${item.slug}`)}</loc>
  <news:news>
    <news:publication>
      <news:name>Kurasikapa Media TV</news:name>
      <news:language>${xml(item.locale)}</news:language>
    </news:publication>
    <news:publication_date>${xml(item.publishedAt ?? '')}</news:publication_date>
    <news:title>${xml(item.title)}</news:title>
  </news:news>
</url>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`
}

const xml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')
