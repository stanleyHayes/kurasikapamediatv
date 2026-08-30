import type { ArticleView, CardArticleView } from './article-view'

export const TRENDING_SIZE = 3
export const BRIEFING_SIZE = 4

export interface HomeRails {
  readonly lead: CardArticleView | undefined
  readonly briefing: readonly CardArticleView[]
  readonly trending: readonly ArticleView[]
}

export function homeRails(
  items: readonly CardArticleView[],
  mostRead: readonly ArticleView[],
): HomeRails {
  const [lead, ...rest] = items
  const briefing = rest.slice(0, BRIEFING_SIZE)
  const occupied = new Set<string>([
    ...(lead === undefined ? [] : [lead.id]),
    ...briefing.map((article) => article.id),
  ])

  return {
    lead,
    briefing,
    trending: trendingRail(mostRead, rest.slice(BRIEFING_SIZE), occupied),
  }
}

/**
 * Homepage Trending Now: unique-reader ranking first, leftover recency to
 * fill empty slots. Stories already in the hero or briefing stay out so the
 * three regions are not the same three headlines.
 */
export function trendingRail(
  mostRead: readonly ArticleView[],
  recency: readonly ArticleView[],
  occupied: ReadonlySet<string>,
): readonly ArticleView[] {
  const chosen: ArticleView[] = []
  const seen = new Set(occupied)

  for (const article of [...mostRead, ...recency]) {
    if (seen.has(article.id)) continue
    seen.add(article.id)
    chosen.push(article)
    if (chosen.length === TRENDING_SIZE) break
  }

  return chosen
}
