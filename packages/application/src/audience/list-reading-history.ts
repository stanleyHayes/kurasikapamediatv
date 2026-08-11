import type { Actor, Article, ArticleId } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import { type Page, clampLimit } from '../ports/pagination'
import type { ReadingRepository } from '../ports/reading-repository'
import type { UseCase } from '../ports/use-case'

export interface ListReadingHistoryInput {
  readonly actor: Actor
  readonly after?: string | undefined
  readonly limit?: number | undefined
}

export interface ReadArticle {
  readonly article: Article
  readonly readAt: Date
}

const LIMITS = { fallback: 20, max: 100 } as const

export class ListReadingHistory implements UseCase<ListReadingHistoryInput, Page<ReadArticle>> {
  constructor(
    private readonly readings: ReadingRepository,
    private readonly articles: ArticleRepository,
  ) {}

  async execute(input: ListReadingHistoryInput): Promise<Page<ReadArticle>> {
    const page = await this.readings.listFor(input.actor.id, {
      after: input.after,
      limit: clampLimit(input.limit, LIMITS),
    })

    const found = await this.articles.findManyByIds(page.items.map((r) => r.articleId))
    const byId = new Map(found.map((a) => [String(a.id), a]))
    const items = page.items.flatMap((row) => toRead(row.articleId, row.readAt, byId))

    return { items, nextCursor: page.nextCursor }
  }
}

function toRead(
  id: ArticleId,
  readAt: Date,
  byId: Map<string, Article>,
): readonly ReadArticle[] {
  const article = byId.get(String(id))
  return article === undefined ? [] : [{ article, readAt }]
}
