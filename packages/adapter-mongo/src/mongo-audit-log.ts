import type { AuditLog, Cursor, Page } from '@kurasikapa/application'
import { AuditEntry, type UserId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { AUDIT_ENTRIES, type AuditEntryDocument } from './documents'

/**
 * The audit log on MongoDB.
 *
 * `insertOne` and `find`. There is no update path and no delete path in this
 * file, and that is the implementation of product rule 4 rather than a
 * description of it — an audit log an administrator can edit answers no
 * question worth asking.
 *
 * Mongo cannot forbid a write we never make, so the guarantee is structural:
 * the port exposes only append and list, and this file exposes only append and
 * list. Anyone weakening it has to add a method, which is a reviewable act.
 */
export class MongoAuditLog implements AuditLog {
  private readonly entries: Collection<AuditEntryDocument>

  constructor(db: Db) {
    this.entries = db.collection<AuditEntryDocument>(AUDIT_ENTRIES)
  }

  async append(entry: AuditEntry): Promise<void> {
    const props = entry.snapshot()

    // insertOne, never upsert. An upsert on a colliding id would overwrite an
    // existing record, which is the exact operation this collection forbids.
    await this.entries.insertOne({
      _id: props.id,
      action: props.action,
      actorId: props.actorId,
      subjectId: props.subjectId,
      occurredAt: props.occurredAt,
      detail: props.detail,
    })
  }

  async list(cursor: Cursor): Promise<Page<AuditEntry>> {
    // Keyset on occurredAt descending — an investigation starts from what just
    // happened and pages backwards.
    const filter =
      cursor.after === undefined ? {} : { occurredAt: { $lt: new Date(cursor.after) } }

    const docs = await this.entries
      .find(filter)
      .sort({ occurredAt: -1 })
      .limit(cursor.limit + 1)
      .toArray()

    const page = docs.slice(0, cursor.limit)
    // Derived from the last row rather than from `hasMore` plus an optional
    // chain: if another page exists then this one is non-empty, so the
    // "missing last row" case is unreachable and testing it is impossible.
    const last = docs.length > cursor.limit ? page.at(-1) : undefined

    return {
      items: page.map(toDomain),
      nextCursor: last === undefined ? null : last.occurredAt.toISOString(),
    }
  }
}

const toDomain = (doc: AuditEntryDocument): AuditEntry =>
  AuditEntry.record({
    id: doc._id,
    action: doc.action,
    actorId: doc.actorId as UserId,
    subjectId: doc.subjectId,
    occurredAt: doc.occurredAt,
    detail: doc.detail,
  })
