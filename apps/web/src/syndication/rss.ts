import type { ArticleView } from '@kurasikapa/web-kit/read-model/article-view'

export interface RssFeed {
  readonly title: string
  readonly home: string
  readonly builtAt: Date
  readonly items: readonly ArticleView[]
}

/**
 * RSS 2.0 for published articles.
 *
 * Bodies stay off the wire: an excerpt field we do not have must not become
 * invented standfirsts. Title, link and the real publish time are enough for
 * a reader or another CMS to discover the story.
 */
export function rssXml(feed: RssFeed): string {
  const items = feed.items.map((item) => entry(item, feed.home)).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${escapeXml(feed.title)}</title>
<link>${escapeXml(feed.home)}</link>
<description>${escapeXml(feed.title)}</description>
<lastBuildDate>${feed.builtAt.toUTCString()}</lastBuildDate>
${items}</channel>
</rss>
`
}

function entry(item: ArticleView, home: string): string {
  const link = `${home.replace(/\/$/u, '')}/${item.locale}/articles/${item.slug}`
  const pub =
    item.publishedAt === null ? '' : `<pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>\n`

  return `<item>
<title>${escapeXml(item.title)}</title>
<link>${escapeXml(link)}</link>
<guid isPermaLink="true">${escapeXml(link)}</guid>
${pub}</item>
`
}

function escapeXml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
}
