import { type Article, isPubliclyVisible } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import { clampLimit } from '../ports/pagination'
import type { ArticleReadRank, ReadingRepository } from '../ports/reading-repository'
import type { UseCase } from '../ports/use-case'

export interface ListMostReadInput {
  readonly locale: string
  readonly limit?: number | undefined
}

const LIMITS = { fallback: 3, max: 12 } as const
/** Extra ranks so unpublished or other-locale rows can be skipped. */
const OVERFETCH = 4

/**
 * Public ranking by unique readers — not pageviews, not a named person's list.
 *
 * A draft that somehow has rows is dropped here, same belt as every other
 * public query: visibility is a domain check, not a repository filter.
 */
export class ListMostRead implements UseCase<ListMostReadInput, readonly Article[]> {
  constructor(
    private readonly readings: ReadingRepository,
    private readonly articles: ArticleRepository,
  ) {}

  async execute(input: ListMostReadInput): Promise<readonly Article[]> {
    const limit = clampLimit(input.limit, LIMITS)
    const ranks = await this.readings.rankByReaders(limit * OVERFETCH)
    const found = await this.articles.findManyByIds(ranks.map((row) => row.articleId))
    const byId = new Map(found.map((article) => [article.id, article]))

    return ranks.flatMap((row) => visibleInLocale(row, byId, input.locale)).slice(0, limit)
  }
}

function visibleInLocale(
  rank: ArticleReadRank,
  byId: Map<Article['id'], Article>,
  locale: string,
): readonly Article[] {
  const article = byId.get(rank.articleId)
  if (article === undefined) return []
  if (!isPubliclyVisible(article.status) || article.locale !== locale) return []
  return [article]
}
