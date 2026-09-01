import type { BroadcastRepository } from '@kurasikapa/application'
import { Broadcast, type BroadcastId, broadcastId, userId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { BROADCASTS, type BroadcastDocument } from './documents'
import { ensureBroadcastIndexes } from './indexes'

export class MongoBroadcastRepository implements BroadcastRepository {
  private readonly rows: Collection<BroadcastDocument>
  private readonly db: Db
  private ready: Promise<void> | undefined

  constructor(db: Db) {
    this.rows = db.collection<BroadcastDocument>(BROADCASTS)
    this.db = db
  }

  async findById(id: BroadcastId): Promise<Broadcast | null> {
    await this.ensureReady()
    const doc = await this.rows.findOne({ _id: id })
    return doc === null ? null : toDomain(doc)
  }

  /**
   * The reader-facing "are we on air?" lookup, and the gate StartBroadcast
   * reads before provisioning anything.
   *
   * `state: 'live'` is written as a literal on purpose: it is what makes the
   * partial index usable (Mongo only picks a partial index when the query
   * provably matches its filter), and it is the predicate whose loss would put
   * a torn-down broadcast on the front page. Filtering in memory afterwards
   * would work and would also drag the whole archive off disk every request.
   */
  async currentLive(locale: string): Promise<Broadcast | null> {
    await this.ensureReady()
    const doc = await this.rows.findOne(
      { locale, state: 'live' },
      // At most one row can match — `broadcast_live_per_locale_unique` sees to
      // that. The sort costs nothing over one document and makes the answer
      // deterministic rather than storage-order if a deployment predating the
      // index left two behind: the later start is the one an operator means.
      { sort: { startedAt: -1, _id: -1 } },
    )

    return doc === null ? null : toDomain(doc)
  }

  /**
   * The studio's schedule and history for one locale, newest first.
   *
   * Ordered by `scheduledFor` rather than `startedAt`, so a broadcast that has
   * not gone live yet still sorts into the list where the operator scheduled
   * it — `startedAt` is null until it goes on air, and a null-sorted row lands
   * at one end of the list regardless of when it is due.
   */
  async list(locale: string, limit: number): Promise<readonly Broadcast[]> {
    await this.ensureReady()
    const docs = await this.rows
      .find({ locale })
      .sort({ scheduledFor: -1, _id: -1 })
      .limit(limit)
      .toArray()

    return docs.map(toDomain)
  }

  /**
   * Upsert on the aggregate's own id. Every transition returns a new Broadcast,
   * so the whole snapshot is written each time and a stale field cannot survive.
   *
   * A second live broadcast in one locale fails here with a duplicate key,
   * which is the intended outcome — see the index comment. StartBroadcast
   * treats any save failure as a reason to tear its channel down, so the loser
   * of that race leaves nothing behind.
   */
  async save(broadcast: Broadcast): Promise<void> {
    await this.ensureReady()
    const { id, ...rest } = broadcast.snapshot()

    await this.rows.updateOne({ _id: id }, { $set: rest }, { upsert: true })
  }

  private ensureReady(): Promise<void> {
    // Lazy keeps composition side-effect free; every real operation still
    // waits for the correctness index before it can read or write.
    this.ready ??= ensureBroadcastIndexes(this.db)
    return this.ready
  }
}

const toDomain = (doc: BroadcastDocument): Broadcast =>
  Broadcast.reconstitute({
    id: broadcastId(doc._id),
    title: doc.title,
    locale: doc.locale,
    channelArn: doc.channelArn,
    playbackUrl: doc.playbackUrl,
    captionMode: doc.captionMode ?? 'unverified',
    state: doc.state,
    scheduledFor: doc.scheduledFor,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt,
    createdBy: userId(doc.createdBy),
  })
