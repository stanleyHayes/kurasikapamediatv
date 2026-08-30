import type { SitePageRepository } from '@kurasikapa/application'
import { SitePage, type SitePageKey } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { SITE_PAGES, type SitePageDocument } from './documents'

export class MongoSitePageRepository implements SitePageRepository {
  private readonly pages: Collection<SitePageDocument>
  constructor(db: Db) { this.pages = db.collection<SitePageDocument>(SITE_PAGES) }
  async find(key: SitePageKey, locale: string): Promise<SitePage | null> {
    const doc = await this.pages.findOne({ _id: `${key}:${locale}` })
    return doc === null ? null : toDomain(doc)
  }
  async list(locale: string): Promise<readonly SitePage[]> {
    return (await this.pages.find({ locale }).sort({ key: 1 }).toArray()).map(toDomain)
  }
  async save(page: SitePage): Promise<void> {
    const props = page.snapshot()
    await this.pages.updateOne({ _id: props.id }, { $set: { key: props.key, locale: props.locale, title: props.title, lead: props.lead, body: props.body, updatedAt: props.updatedAt } }, { upsert: true })
  }
}

function toDomain(doc: SitePageDocument): SitePage {
  return SitePage.reconstitute({ id: doc._id, key: doc.key as SitePageKey, locale: doc.locale, title: doc.title, lead: doc.lead, body: doc.body, updatedAt: doc.updatedAt })
}
