import type { ProgrammeRepository } from '@kurasikapa/application'
import { Programme, assetId, presenterId, programmeId, userId, type ProgrammeId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { PROGRAMMES, type ProgrammeDocument } from './television-documents'
import { ensureTelevisionIndexes } from './television-indexes'

export class MongoProgrammeRepository implements ProgrammeRepository {
  private readonly rows: Collection<ProgrammeDocument>
  private ready: Promise<void> | undefined

  constructor(private readonly db: Db) { this.rows = db.collection<ProgrammeDocument>(PROGRAMMES) }

  async findById(id: ProgrammeId): Promise<Programme | null> {
    await this.ensureReady()
    const doc = await this.rows.findOne({ _id: id })
    return doc === null ? null : toDomain(doc)
  }

  async listPublished(locale: string): Promise<readonly Programme[]> {
    await this.ensureReady()
    return (await this.rows.find({ locale, published: true }).sort({ title: 1 }).toArray()).map(toDomain)
  }

  async save(programme: Programme): Promise<void> {
    await this.ensureReady()
    const { id, presenterIds, ...rest } = programme.snapshot()
    await this.rows.updateOne({ _id: id }, { $set: { ...rest, presenterIds: [...presenterIds] } }, { upsert: true })
  }

  private ensureReady(): Promise<void> {
    this.ready ??= ensureTelevisionIndexes(this.db)
    return this.ready
  }
}

const toDomain = (doc: ProgrammeDocument): Programme => {
  const { _id, ...props } = doc
  return Programme.reconstitute({
    ...props,
    id: programmeId(_id),
    presenterIds: doc.presenterIds.map(presenterId),
    artworkAssetId: doc.artworkAssetId === null ? null : assetId(doc.artworkAssetId),
    createdBy: userId(doc.createdBy),
  })
}
