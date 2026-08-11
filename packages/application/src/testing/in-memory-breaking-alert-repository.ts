import type { ArticleId, BreakingAlert } from '@kurasikapa/domain'
import type { BreakingAlertRepository } from '../ports/breaking-alert-repository'

export class InMemoryBreakingAlertRepository implements BreakingAlertRepository {
  private readonly rows = new Map<string, BreakingAlert>()

  findByArticleId(articleId: ArticleId): Promise<BreakingAlert | null> {
    return Promise.resolve(this.rows.get(articleId) ?? null)
  }

  save(alert: BreakingAlert): Promise<void> {
    this.rows.set(alert.articleId, alert)
    return Promise.resolve()
  }
}
