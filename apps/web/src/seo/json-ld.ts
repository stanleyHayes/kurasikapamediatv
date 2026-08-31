import type { ArticleView } from '@kurasikapa/web-kit/read-model/article-view'

export interface Publisher {
  readonly name: string
  readonly url: string
}

export interface ArticleIdentity {
  readonly image?: string
  readonly authorUrl?: string
}

/**
 * schema.org NewsArticle.
 *
 * `NewsArticle` rather than the generic `Article`: it is what Google News and
 * Discover consume, and for a media house that surface is the point of doing
 * this at all.
 *
 * Nothing is invented. A field we cannot source honestly is omitted rather
 * than filled with a plausible default — structured data that misstates an
 * author or a date is worse than absent structured data, because search
 * engines act on it.
 */
export function newsArticleJsonLd(
  article: ArticleView & { readonly authorName?: string | null },
  publisher: Publisher,
  canonical: string,
  identity?: ArticleIdentity,
): Record<string, unknown> {
  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    inLanguage: article.locale,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    url: canonical,
    isAccessibleForFree: true,
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: publisher.name,
      url: publisher.url,
    },
  }

  if (identity?.image !== undefined && identity.image !== '') json['image'] = [identity.image]

  // Only present once the article is actually live. Emitting a publish date
  // for a draft would be a lie told to a crawler.
  if (article.publishedAt !== null) {
    json['datePublished'] = article.publishedAt
    json['dateModified'] = article.publishedAt
  }

  if (typeof article.authorName === 'string' && article.authorName !== '') {
    json['author'] = { '@type': 'Person', name: article.authorName, ...(identity?.authorUrl === undefined ? {} : { url: identity.authorUrl }) }
  }

  return json
}

export const organisationJsonLd = (publisher: Publisher): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'NewsMediaOrganization',
  name: publisher.name,
  url: publisher.url,
})

/**
 * Serialised for a <script type="application/ld+json"> block.
 *
 * `<` is escaped because a title containing `</script>` would otherwise close
 * the block and inject markup — a real XSS route through a headline, and
 * headlines are attacker-adjacent on a site that accepts contributed copy.
 */
export const asScriptContent = (json: Record<string, unknown>): string =>
  JSON.stringify(json).replace(/</gu, '\\u003c')
