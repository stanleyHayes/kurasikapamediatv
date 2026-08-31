import type { InsightRepository, NewsroomReport, RankedMetric, StoryMetric, TrendPoint } from '@kurasikapa/application'
import type { PageView } from '@kurasikapa/domain'
import type { Collection, Db, Document } from 'mongodb'
import { ARTICLES, CATEGORIES, LEGACY_USERS, NEWSLETTER_SUBSCRIBERS, PAGE_VIEWS, type PageViewDocument } from './documents'

interface CountRow { readonly _id: string; readonly value: number }
interface TrendRow { readonly _id: string; readonly views: number; readonly visitors: readonly string[] }

export class MongoInsightRepository implements InsightRepository {
  private readonly views: Collection<PageViewDocument>
  constructor(private readonly db: Db) { this.views = db.collection<PageViewDocument>(PAGE_VIEWS) }

  async append(view: PageView): Promise<void> {
    const row = view.snapshot()
    await this.views.insertOne({ _id: row.id, articleId: row.articleId, locale: row.locale, visitorHash: row.visitorHash, channel: row.channel, occurredAt: row.occurredAt })
  }

  async report(days: number, to: Date): Promise<NewsroomReport> {
    const from = new Date(to.getTime() - days * 86_400_000)
    const range = { occurredAt: { $gte: from, $lte: to } }
    const [summary, traffic, acquisition, topStories, topCategories, topAuthors, newsletter] = await Promise.all([
      this.summary(range), this.traffic(range), this.rank('channel', range), this.storyRank(range),
      this.articleDimensionRank('categoryId', CATEGORIES, range),
      this.articleDimensionRank('authorId', LEGACY_USERS, range), this.newsletter(from, to),
    ])
    return { ...summary, traffic, acquisition, topStories, topCategories, topAuthors, ...newsletter }
  }

  private async summary(range: Document): Promise<Pick<NewsroomReport, 'views' | 'uniqueReaders' | 'returningReaders' | 'searchViews'>> {
    const [views, visitors, returning, searchViews] = await Promise.all([
      this.views.countDocuments(range), this.views.distinct('visitorHash', range),
      this.views.aggregate<{ value: number }>([{ $match: range }, { $group: { _id: '$visitorHash', count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }, { $count: 'value' }]).next(),
      this.views.countDocuments({ ...range, channel: 'search' }),
    ])
    return { views, uniqueReaders: visitors.length, returningReaders: returning?.value ?? 0, searchViews }
  }

  private async traffic(range: Document): Promise<readonly TrendPoint[]> {
    const rows = await this.views.aggregate<TrendRow>([
      { $match: range },
      { $group: { _id: { $dateToString: { date: '$occurredAt', format: '%Y-%m-%d', timezone: 'UTC' } }, views: { $sum: 1 }, visitors: { $addToSet: '$visitorHash' } } },
      { $sort: { _id: 1 } },
    ]).toArray()
    return rows.map((row) => ({ label: row._id, views: row.views, uniqueReaders: row.visitors.length }))
  }

  private async rank(field: string, range: Document): Promise<readonly RankedMetric[]> {
    const rows = await this.views.aggregate<CountRow>([
      { $match: range }, { $group: { _id: `$${field}`, value: { $sum: 1 } } },
      { $sort: { value: -1, _id: 1 } }, { $limit: 8 },
    ]).toArray()
    return rows.map((row) => ({ label: row._id, value: row.value }))
  }

  private async storyRank(range: Document): Promise<readonly StoryMetric[]> {
    const rows = await this.views.aggregate<{ _id: string; value: number; title?: string }>([
      { $match: range }, { $group: { _id: '$articleId', value: { $sum: 1 } } }, { $sort: { value: -1 } }, { $limit: 8 },
      { $lookup: { from: ARTICLES, localField: '_id', foreignField: '_id', as: 'article' } },
      { $set: { title: { $first: '$article.title' } } },
    ]).toArray()
    return rows.map((row) => ({ id: row._id, label: row.title ?? row._id, value: row.value }))
  }

  private async articleDimensionRank(field: string, fromCollection: string, range: Document): Promise<readonly RankedMetric[]> {
    const rows = await this.views.aggregate<{ _id: string; value: number; label?: string }>([
      { $match: range }, { $lookup: { from: ARTICLES, localField: 'articleId', foreignField: '_id', as: 'article' } },
      { $set: { dimension: { $first: `$article.${field}` } } }, { $group: { _id: '$dimension', value: { $sum: 1 } } },
      { $sort: { value: -1 } }, { $limit: 8 }, { $lookup: { from: fromCollection, localField: '_id', foreignField: '_id', as: 'detail' } },
      { $set: { label: { $ifNull: [{ $first: '$detail.name' }, { $first: '$detail.names.en' }] } } },
    ]).toArray()
    return rows.map((row) => ({ label: row.label ?? row._id, value: row.value }))
  }

  private async newsletter(from: Date, to: Date): Promise<Pick<NewsroomReport, 'newsletterSubscribers' | 'newsletterGrowth' | 'newsletterTrend'>> {
    const rows = this.db.collection(NEWSLETTER_SUBSCRIBERS)
    const [total, trend] = await Promise.all([
      rows.countDocuments({ state: 'confirmed' }),
      rows.aggregate<CountRow>([
        { $match: { state: 'confirmed', confirmedAt: { $gte: from, $lte: to } } },
        { $group: { _id: { $dateToString: { date: '$confirmedAt', format: '%Y-%m-%d', timezone: 'UTC' } }, value: { $sum: 1 } } }, { $sort: { _id: 1 } },
      ]).toArray(),
    ])
    return { newsletterSubscribers: total, newsletterGrowth: trend.reduce((sum, row) => sum + row.value, 0), newsletterTrend: trend.map((row) => ({ label: row._id, value: row.value })) }
  }
}
