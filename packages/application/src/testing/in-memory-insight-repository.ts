import type { InsightRepository, NewsroomReport } from '../ports/insight-repository'
import type { PageView } from '@kurasikapa/domain'

export class InMemoryInsightRepository implements InsightRepository {
  readonly views: PageView[] = []
  reportValue: NewsroomReport = {
    views: 0, uniqueReaders: 0, returningReaders: 0, newsletterSubscribers: 0,
    newsletterGrowth: 0, searchViews: 0, traffic: [], acquisition: [], topStories: [],
    topCategories: [], topAuthors: [], newsletterTrend: [],
  }

  append(view: PageView): Promise<void> { this.views.push(view); return Promise.resolve() }
  report(): Promise<NewsroomReport> { return Promise.resolve(this.reportValue) }
}
