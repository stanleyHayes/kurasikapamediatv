import type { ArticleId, BreakingAlert } from '@kurasikapa/domain'

export interface BreakingAlertRepository {
  findByArticleId(articleId: ArticleId): Promise<BreakingAlert | null>
  save(alert: BreakingAlert): Promise<void>
}
