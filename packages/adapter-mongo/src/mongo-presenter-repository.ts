import type { PresenterRepository } from '@kurasikapa/application'
import { Presenter, assetId, presenterId, userId, type PresenterId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { PRESENTERS, type PresenterDocument } from './television-documents'
import { ensureTelevisionIndexes } from './television-indexes'

export class MongoPresenterRepository implements PresenterRepository {
  private readonly rows: Collection<PresenterDocument>
  private ready: Promise<void> | undefined

  constructor(private readonly db: Db) {
    this.rows = db.collection<PresenterDocument>(PRESENTERS)
  }

  async findById(id: PresenterId): Promise<Presenter | null> {
    await this.ensureReady()
    const doc = await this.rows.findOne({ _id: id })
    return doc === null ? null : toDomain(doc)
  }

  async listPublished(locale: string): Promise<readonly Presenter[]> {
    await this.ensureReady()
    return (await this.rows.find({ locale, published: true }).sort({ name: 1 }).toArray()).map(toDomain)
  }

  async save(presenter: Presenter): Promise<void> {
    await this.ensureReady()
    const { id, ...rest } = presenter.snapshot()
    await this.rows.updateOne({ _id: id }, { $set: rest }, { upsert: true })
  }

  private ensureReady(): Promise<void> {
    this.ready ??= ensureTelevisionIndexes(this.db)
    return this.ready
  }
}

const toDomain = (doc: PresenterDocument): Presenter => {
  const { _id, ...props } = doc
  return Presenter.reconstitute({
    ...props,
    id: presenterId(_id),
    portraitAssetId: doc.portraitAssetId === null ? null : assetId(doc.portraitAssetId),
    createdBy: userId(doc.createdBy),
  })
}
