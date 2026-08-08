import type { Db } from 'mongodb'
import { ARTICLES, REVISIONS, type ArticleDocument, type RevisionDocument } from './documents.js'

/**
 * Every index here exists because a specific screen or rule needs it.
 * Kept beside the queries that use them so the two cannot drift apart.
 */
export async function ensureIndexes(db: Db): Promise<void> {
  const articles = db.collection<ArticleDocument>(ARTICLES)
  const revisions = db.collection<RevisionDocument>(REVISIONS)

  await articles.createIndexes([
    // One slug per locale. This is the uniqueness rule the domain cannot enforce.
    { key: { locale: 1, slug: 1 }, unique: true, name: 'locale_slug_unique' },
    // One document per (family, locale) — a family cannot have two French versions.
    { key: { familyId: 1, locale: 1 }, unique: true, name: 'family_locale_unique' },
    // Homepage rails and category listings, both keyset-paginated on (publishedAt, _id).
    { key: { status: 1, publishedAt: -1, _id: -1 }, name: 'published_recent' },
    { key: { categoryId: 1, status: 1, publishedAt: -1, _id: -1 }, name: 'category_published' },
    { key: { tagIds: 1, status: 1, publishedAt: -1 }, name: 'tag_published' },
    // "My drafts" in the CMS.
    { key: { authorId: 1, status: 1, updatedAt: -1 }, name: 'author_recent' },
    // The publishing cron scans only scheduled articles, so the index is partial.
    {
      key: { scheduledAt: 1 },
      name: 'due_for_publication',
      partialFilterExpression: { status: 'scheduled' },
    },
  ])

  await revisions.createIndexes([
    // Append-only history, newest first. Unique so a torn write cannot duplicate a seq.
    { key: { articleId: 1, seq: -1 }, unique: true, name: 'article_seq_unique' },
  ])
}
