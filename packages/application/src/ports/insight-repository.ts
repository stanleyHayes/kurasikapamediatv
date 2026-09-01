import type { ArticleEngagement, PageView } from '@kurasikapa/domain'

export interface TrendPoint { readonly label: string; readonly views: number; readonly uniqueReaders: number }
export interface RankedMetric { readonly label: string; readonly value: number }
export interface StoryMetric extends RankedMetric { readonly id: string }
export interface ReadingDepthMetric { readonly depth: 25 | 50 | 75 | 100; readonly readers: number; readonly retention: number }

export interface NewsroomReport {
  readonly views: number
  readonly uniqueReaders: number
  readonly returningReaders: number
  readonly newsletterSubscribers: number
  readonly newsletterGrowth: number
  readonly searchViews: number
  readonly traffic: readonly TrendPoint[]
  readonly acquisition: readonly RankedMetric[]
  readonly topStories: readonly StoryMetric[]
  readonly topCategories: readonly RankedMetric[]
  readonly topAuthors: readonly RankedMetric[]
  readonly newsletterTrend: readonly RankedMetric[]
  readonly averageActiveSeconds: number
  readonly readingDepth: readonly ReadingDepthMetric[]
}

export interface InsightRepository {
  append(view: PageView): Promise<void>
  appendEngagement(engagement: ArticleEngagement): Promise<void>
  report(days: number, to: Date): Promise<NewsroomReport>
}
