import { PageView, type AcquisitionChannel, type ArticleId } from '@kurasikapa/domain'
import type { ArticleRepository } from '../ports/article-repository'
import type { ClockPort, IdPort } from '../ports/ambient'
import type { InsightRepository } from '../ports/insight-repository'
import type { UseCase } from '../ports/use-case'

export interface RecordPageViewInput {
  readonly articleId: ArticleId
  readonly locale: string
  readonly visitorHash: string
  readonly channel: AcquisitionChannel
}

export class RecordPageView implements UseCase<RecordPageViewInput, void> {
  constructor(private readonly deps: { articles: ArticleRepository; insights: InsightRepository; clock: ClockPort; ids: IdPort }) {}

  async execute(input: RecordPageViewInput): Promise<void> {
    const article = await this.deps.articles.findById(input.articleId)
    if (article?.status !== 'published' || article.locale !== input.locale) {
      throw new Error('Article is not published')
    }
    await this.deps.insights.append(PageView.record({ ...input, id: this.deps.ids.next(), occurredAt: this.deps.clock.now() }))
  }
}
