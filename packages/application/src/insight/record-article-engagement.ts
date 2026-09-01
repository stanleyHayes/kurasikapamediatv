import { ArticleEngagement, type ArticleId, type ReadingDepth } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { InsightRepository } from '../ports/insight-repository'
import type { UseCase } from '../ports/use-case'

export interface RecordArticleEngagementInput {
  readonly articleId: ArticleId
  readonly locale: string
  readonly visitorHash: string
  readonly scrollDepth: ReadingDepth
  readonly activeSeconds: number
}

export class RecordArticleEngagement implements UseCase<RecordArticleEngagementInput, void> {
  constructor(private readonly deps: {
    articles: ArticleRepository
    insights: InsightRepository
    clock: ClockPort
    ids: IdPort
  }) {}

  async execute(input: RecordArticleEngagementInput): Promise<void> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article?.status !== 'published' || article.locale !== input.locale) {
      throw new Error('Article is not published')
    }
    await this.deps.insights.appendEngagement(ArticleEngagement.record({
      ...input, id: this.deps.ids.next(), occurredAt: this.deps.clock.now(),
    }))
  }
}
