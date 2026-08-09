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

  async findManyByIds(ids: readonly RevisionId[]): Promise<readonly Revision[]> {
    // Guard the empty case: `$in: []` is a round trip that can only return
    // nothing, and listings hit this whenever a page has no approved revisions.
    if (ids.length === 0) return []

    const docs = await this.revisions.find({ _id: { $in: [...ids] } }).toArray()
    return docs.map(revisionToDomain)
  }

  async findLatestForArticles(ids: readonly ArticleId[]): Promise<readonly Revision[]> {
    if (ids.length === 0) return []

    // Sort descending then take the first of each group: $group's $first is
    // defined by the incoming order, so the sort is what makes this correct.
    const docs = await this.revisions
      .aggregate<RevisionDocument>([
        { $match: { articleId: { $in: [...ids] } } },
        { $sort: { articleId: 1, seq: -1 } },
        { $group: { _id: '$articleId', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
      ])
      .toArray()

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
