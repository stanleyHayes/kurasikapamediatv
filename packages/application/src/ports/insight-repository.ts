import type { PageView } from '@kurasikapa/domain'

export interface TrendPoint { readonly label: string; readonly views: number; readonly uniqueReaders: number }
export interface RankedMetric { readonly label: string; readonly value: number }
export interface StoryMetric extends RankedMetric { readonly id: string }

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
}

export interface InsightRepository {
  append(view: PageView): Promise<void>
  report(days: number, to: Date): Promise<NewsroomReport>
}
