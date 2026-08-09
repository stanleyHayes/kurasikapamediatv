import type { CategoryRepository } from '@kurasikapa/application'
import { Category, type CategoryId, categoryId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { CATEGORIES, type CategoryDocument } from './documents'

export class MongoCategoryRepository implements CategoryRepository {
  private readonly categories: Collection<CategoryDocument>

  constructor(db: Db) {
    this.categories = db.collection<CategoryDocument>(CATEGORIES)
  }

  async findById(id: CategoryId): Promise<Category | null> {
    const doc = await this.categories.findOne({ _id: id })
    return doc === null ? null : toDomain(doc)
  }

  async findBySlug(slug: string, locale: string): Promise<Category | null> {
    // Dotted path, so the lookup is a single indexed probe rather than a scan
    // over every category's slug map.
    const doc = await this.categories.findOne({ [`slugs.${locale}`]: slug })
    return doc === null ? null : toDomain(doc)
  }

  async listForLocale(locale: string): Promise<readonly Category[]> {
    const docs = await this.categories
      .find({ [`slugs.${locale}`]: { $exists: true } })
      .sort({ order: 1 })
      .toArray()

    return docs.map(toDomain)
  }

  async save(category: Category): Promise<void> {
    const props = category.snapshot()
    const { id, ...rest } = props

    await this.categories.updateOne({ _id: id }, { $set: rest }, { upsert: true })
  }
}

const toDomain = (doc: CategoryDocument): Category =>
  Category.reconstitute({
    id: categoryId(doc._id),
    parentId: doc.parentId === null ? null : categoryId(doc.parentId),
    // Documents written before descriptions existed have no field at all;
    // an absent map reads the same as "no description in any locale".
    descriptions: doc.descriptions ?? {},
    slugs: doc.slugs,
    names: doc.names,
    order: doc.order,
  })
