import type { MetadataRoute } from 'next'
import { loadPublishedList, loadSections } from '@/bff/load-public'
import { container } from '@/composition/container'
import { env } from '@/composition/env'
import { routing } from '@/i18n/routing'
import { toArticleView, type ArticleView } from '@/read-model/article-view'

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
  const apiUrl = env().API_URL
  const entries: MetadataRoute.Sitemap = []

  for (const locale of routing.locales) {
    entries.push({ url: `${base}/${locale}`, changeFrequency: 'hourly', priority: 1 })
    entries.push({ url: `${base}/${locale}/search`, changeFrequency: 'monthly', priority: 0.3 })
    await appendSections(entries, locale, base, apiUrl)
    await appendArticles(entries, locale, base, apiUrl)
  }

  return entries
}

async function appendSections(
  entries: MetadataRoute.Sitemap,
  locale: string,
  base: string,
  apiUrl: string | undefined,
): Promise<void> {
  const sections = await loadSections(locale, apiUrl, async () => {
    const cats = await container().listSections.execute({ locale })
    return cats.map((category) => ({ slug: category.slugIn(locale).value }))
  })
  for (const category of sections) {
    entries.push({
      url: `${base}/${locale}/sections/${category.slug}`,
      changeFrequency: 'hourly',
      priority: 0.8,
    })
  }
}

async function appendArticles(
  entries: MetadataRoute.Sitemap,
  locale: string,
  base: string,
  apiUrl: string | undefined,
): Promise<void> {
  let cursor: string | undefined
  while (entries.length < MAX_URLS) {
    const page = await loadPublishedList({ locale, limit: PAGE_SIZE, after: cursor }, apiUrl, () =>
      publishedViaTypeScript(locale, cursor),
    )
    for (const article of page.items) {
      entries.push({
        url: `${base}/${locale}/articles/${article.slug}`,
        lastModified: article.publishedAt ?? undefined,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }
    if (page.nextCursor === null) break
    cursor = page.nextCursor
  }
}

async function publishedViaTypeScript(
  locale: string,
  after: string | undefined,
): Promise<{ items: ArticleView[]; nextCursor: string | null }> {
  const loaded = await container().listPublishedArticles.execute({
    locale,
    limit: PAGE_SIZE,
    after,
  })
  return { items: loaded.items.map(toArticleView), nextCursor: loaded.nextCursor }
}
