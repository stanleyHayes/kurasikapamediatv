import type { ScheduleRepository } from '@kurasikapa/application'
import {
  ScheduleSlot,
  assetId,
  programmeId,
  scheduleSlotId,
  userId,
  type AssetId,
  type ScheduleSlotId,
} from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { SCHEDULE_SLOTS, type ScheduleSlotDocument } from './television-documents'
import { ensureTelevisionIndexes } from './television-indexes'

export class MongoScheduleRepository implements ScheduleRepository {
  private readonly rows: Collection<ScheduleSlotDocument>
  private ready: Promise<void> | undefined

  constructor(private readonly db: Db) { this.rows = db.collection<ScheduleSlotDocument>(SCHEDULE_SLOTS) }

  async findById(id: ScheduleSlotId): Promise<ScheduleSlot | null> {
    await this.ensureReady()
    const doc = await this.rows.findOne({ _id: id })
    return doc === null ? null : toDomain(doc)
  }

  async listUpcoming(locale: string, from: Date, limit: number): Promise<readonly ScheduleSlot[]> {
    await this.ensureReady()
    return (await this.rows.find({ locale, state: 'scheduled', startsAt: { $gte: from } })
      .sort({ startsAt: 1 }).limit(limit).toArray()).map(toDomain)
  }

  async listReplays(locale: string, limit: number): Promise<readonly ScheduleSlot[]> {
    await this.ensureReady()
    return (await this.rows.find({ locale, state: 'completed', replayAssetId: { $ne: null } })
      .sort({ startsAt: -1 }).limit(limit).toArray()).map(toDomain)
  }

  async save(slot: ScheduleSlot): Promise<void> {
    await this.ensureReady()
    const { id, ...rest } = slot.snapshot()
    await this.rows.updateOne({ _id: id }, { $set: rest }, { upsert: true })
  }

  private ensureReady(): Promise<void> {
    this.ready ??= ensureTelevisionIndexes(this.db)
    return this.ready
  }
}

const optionalAsset = (id: string | null): AssetId | null => id === null ? null : assetId(id)

const toDomain = (doc: ScheduleSlotDocument): ScheduleSlot => {
  const { _id, ...props } = doc
  return ScheduleSlot.reconstitute({
    ...props,
    id: scheduleSlotId(_id),
    programmeId: programmeId(doc.programmeId),
    replayAssetId: optionalAsset(doc.replayAssetId),
    captionAssetId: optionalAsset(doc.captionAssetId),
    createdBy: userId(doc.createdBy),
  })
}
