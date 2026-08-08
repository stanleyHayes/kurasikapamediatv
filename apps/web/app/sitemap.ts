import type { MetadataRoute } from 'next'
import { container } from '@/composition/container'
import { env } from '@/composition/env'
import { routing } from '@/i18n/routing'

/** Sitemaps cap at 50,000 URLs; we page well inside that and stop. */
const PAGE_SIZE = 50
const MAX_URLS = 5_000

export const revalidate = 3600

/**
 * One sitemap covering every locale.
 *
 * Only published articles appear — a sitemap listing a draft would advertise
 * a URL that 404s, which costs crawl budget and looks like a broken site.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env().APP_URL
  const entries: MetadataRoute.Sitemap = []

  for (const locale of routing.locales) {
    entries.push({ url: `${base}/${locale}`, changeFrequency: 'hourly', priority: 1 })
    entries.push({ url: `${base}/${locale}/search`, changeFrequency: 'monthly', priority: 0.3 })

    for (const category of await container().listSections.execute({ locale })) {
      entries.push({
        url: `${base}/${locale}/sections/${category.slugIn(locale).value}`,
        changeFrequency: 'hourly',
        priority: 0.8,
      })
    }

    let cursor: string | undefined
    while (entries.length < MAX_URLS) {
      const page = await container().listPublishedArticles.execute({
        locale,
        limit: PAGE_SIZE,
        after: cursor,
      })

      for (const article of page.items) {
        entries.push({
          url: `${base}/${locale}/articles/${article.slug.value}`,
          lastModified: article.publishedAt ?? undefined,
          changeFrequency: 'weekly',
          priority: 0.6,
        })
      }

      if (page.nextCursor === null) break
      cursor = page.nextCursor
    }
  }

  return entries
}
