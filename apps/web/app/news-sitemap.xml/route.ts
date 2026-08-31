import { loadPublishedList } from '@kurasikapa/web-kit/bff/load-public'
import { container } from '@kurasikapa/web-kit/composition/container'
import { env } from '@kurasikapa/web-kit/composition/env'
import { routing } from '@kurasikapa/web-kit/i18n/routing'
import { toArticleView, type CardArticleView } from '@kurasikapa/web-kit/read-model/article-view'
import { buildNewsSitemap, recentNewsItems, type NewsSitemapItem } from '@/seo/news-sitemap'

const PAGE_SIZE = 50
const MAX_ITEMS = 1_000

export async function GET(): Promise<Response> {
  const { APP_URL, API_URL } = env()
  const now = new Date()
  const candidates = await Promise.all(routing.locales.map((locale) => loadLocale(locale, API_URL)))
  const items = recentNewsItems(candidates.flat(), now)

  return new Response(buildNewsSitemap(items, APP_URL), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300',
    },
  })
}

async function loadLocale(locale: string, apiUrl: string | undefined): Promise<readonly NewsSitemapItem[]> {
  const items: NewsSitemapItem[] = []
  let cursor: string | undefined
  while (items.length < MAX_ITEMS) {
    const page = await loadPublishedList({ locale, limit: PAGE_SIZE, after: cursor }, apiUrl, () => publishedViaTypeScript(locale, cursor))
    items.push(...page.items.map((item) => ({ locale, slug: item.slug, title: item.title, publishedAt: item.publishedAt })))
    if (page.nextCursor === null) break
    cursor = page.nextCursor
  }
  return items
}

async function publishedViaTypeScript(locale: string, after: string | undefined): Promise<{ items: CardArticleView[]; nextCursor: string | null }> {
  const loaded = await container().listPublishedArticles.execute({ locale, limit: PAGE_SIZE, after })
  return {
    items: loaded.items.map(({ article, excerpt, readingMinutes }) => ({ ...toArticleView(article), excerpt, readingMinutes })),
    nextCursor: loaded.nextCursor,
  }
}
