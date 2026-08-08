import type { RevisionRepository } from '@kurasikapa/application'
import type { ArticleId, Revision, RevisionId } from '@kurasikapa/domain'
import type { Collection, Db } from 'mongodb'
import { REVISIONS, type RevisionDocument } from './documents'
import { revisionToDocument, revisionToDomain } from './mappers'

export class MongoRevisionRepository implements RevisionRepository {
  private readonly revisions: Collection<RevisionDocument>

  constructor(db: Db) {
    this.revisions = db.collection<RevisionDocument>(REVISIONS)
  }

  async findById(id: RevisionId): Promise<Revision | null> {
    const doc = await this.revisions.findOne({ _id: id })
    return doc === null ? null : revisionToDomain(doc)
  }

  async findLatest(articleId: ArticleId): Promise<Revision | null> {
    const doc = await this.revisions.findOne({ articleId }, { sort: { seq: -1 } })
    return doc === null ? null : revisionToDomain(doc)
  }

  async listFor(articleId: ArticleId): Promise<readonly Revision[]> {
    const docs = await this.revisions.find({ articleId }).sort({ seq: 1 }).toArray()
    return docs.map(revisionToDomain)
  }

  /**
   * insertOne, never upsert. History is append-only, and the unique
   * (articleId, seq) index turns a concurrent double-append into a duplicate
   * key error rather than a silently lost revision.
   */
  async append(revision: Revision): Promise<void> {
    await this.revisions.insertOne(revisionToDocument(revision))
  }
}
