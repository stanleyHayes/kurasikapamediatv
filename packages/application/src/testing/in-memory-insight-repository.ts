import type { InsightRepository, NewsroomReport } from '../ports/insight-repository'
import type { ArticleEngagement, PageView } from '@kurasikapa/domain'

export class InMemoryInsightRepository implements InsightRepository {
  readonly views: PageView[] = []
  readonly engagements: ArticleEngagement[] = []
  reportValue: NewsroomReport = {
    views: 0, uniqueReaders: 0, returningReaders: 0, newsletterSubscribers: 0,
    newsletterGrowth: 0, searchViews: 0, traffic: [], acquisition: [], topStories: [],
    topCategories: [], topAuthors: [], newsletterTrend: [], averageActiveSeconds: 0, readingDepth: [],
  }

  append(view: PageView): Promise<void> { this.views.push(view); return Promise.resolve() }
  appendEngagement(engagement: ArticleEngagement): Promise<void> { this.engagements.push(engagement); return Promise.resolve() }
  report(): Promise<NewsroomReport> { return Promise.resolve(this.reportValue) }
}
