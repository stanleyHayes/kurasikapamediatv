import type { Db } from 'mongodb'
import {
  ARTICLES,
  AUDIT_ENTRIES,
  BOOKMARKS,
  LIKES,
  READINGS,
  COMMENTS,
  NEWSLETTER_SUBSCRIBERS,
  BREAKING_ALERTS,
  NEWSLETTER_DIGESTS,
  PUSH_SUBSCRIPTIONS,
  RSS_SOURCES,
  SOCIAL_POSTS,
  CATEGORIES,
  REVISIONS,
  type ArticleDocument,
  type BookmarkDocument,
  type LikeDocument,
  type ReadingDocument,
  type CommentDocument,
  type NewsletterDocument,
  type BreakingAlertDocument,
  type NewsletterDigestDocument,
  type PushSubscriptionDocument,
  type RssSourceDocument,
  type SocialPostDocument,
  type CategoryDocument,
  type RevisionDocument,
} from './documents'

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
    // The review queue: one status, oldest first.
    { key: { status: 1, updatedAt: 1, _id: 1 }, name: 'awaiting_review' },
    // "My drafts" in the CMS.
    { key: { authorId: 1, status: 1, updatedAt: -1 }, name: 'author_recent' },
    // Lexical search. Weighted so a term in the headline outranks the same
    // term buried in the body — which is what a reader means by relevance.
    {
      key: { title: 'text', slug: 'text' },
      name: 'article_text',
      weights: { title: 10, slug: 2 },
      default_language: 'english',
    },
    // The publishing cron scans only scheduled articles, so the index is partial.
    {
      key: { scheduledAt: 1 },
      name: 'due_for_publication',
      partialFilterExpression: { status: 'scheduled' },
    },
  ])

  // One index per launch locale. A wildcard on `slugs.$**` would also work,
  // but it indexes every future locale silently — an explicit list makes
  // adding a language a visible decision.
  const categories = db.collection<CategoryDocument>(CATEGORIES)
  await categories.createIndexes([
    { key: { 'slugs.en': 1 }, unique: true, sparse: true, name: 'slug_en_unique' },
    { key: { 'slugs.fr': 1 }, unique: true, sparse: true, name: 'slug_fr_unique' },
    { key: { order: 1 }, name: 'nav_order' },
  ])

  // The reader's own list, newest first. Reader-scoped by construction: there
  // is no index that supports querying bookmarks without one.
  const bookmarks = db.collection<BookmarkDocument>(BOOKMARKS)
  await bookmarks.createIndexes([{ key: { readerId: 1, savedAt: -1, _id: -1 }, name: 'reader_recent' }])

  // The fan-out worker scans only queued posts whose moment has arrived.
  // Partial, so exhausted and sent posts never enter the scan at all.
  const social = db.collection<SocialPostDocument>(SOCIAL_POSTS)
  await social.createIndexes([
    {
      key: { scheduledAt: 1 },
      name: 'social_due',
      partialFilterExpression: { state: 'queued' },
    },
    { key: { state: 1, scheduledAt: 1 }, name: 'social_queue' },
  ])

  await ensureAudienceIndexes(db)

  await revisions.createIndexes([
    // Append-only history, newest first. Unique so a torn write cannot duplicate a seq.
    { key: { articleId: 1, seq: -1 }, unique: true, name: 'article_seq_unique' },
  ])

  await db.collection(AUDIT_ENTRIES).createIndexes([
    // The audit log only ever grows, so the one query it serves — newest
    // first, paged backwards — must not become a collection scan. Of every
    // index here this is the one whose absence gets worse every day.
    { key: { occurredAt: -1 }, name: 'audit_recent' },
    // "What happened to this article" is the second question anyone asks.
    { key: { subjectId: 1, occurredAt: -1 }, name: 'audit_by_subject' },
  ])
}

async function ensureAudienceIndexes(db: Db): Promise<void> {
  await db.collection<LikeDocument>(LIKES).createIndexes([
    { key: { articleId: 1 }, name: 'article_like_count' },
  ])
  await db.collection<ReadingDocument>(READINGS).createIndexes([
    { key: { readerId: 1, readAt: -1, _id: -1 }, name: 'reader_recent_reads' },
    // Unique-reader ranking for the public most-read rail. One row per
    // (reader, article), so grouping on articleId is unique readers, not hits.
    { key: { articleId: 1 }, name: 'article_read_rank' },
  ])
  await db.collection<CommentDocument>(COMMENTS).createIndexes([
    { key: { articleId: 1, state: 1, createdAt: -1, _id: -1 }, name: 'article_visible_recent' },
    { key: { state: 1, createdAt: 1, _id: 1 }, name: 'pending_oldest' },
  ])
  await db.collection<NewsletterDocument>(NEWSLETTER_SUBSCRIBERS).createIndexes([
    { key: { email: 1 }, unique: true, name: 'subscriber_email_unique' },
    { key: { token: 1 }, unique: true, sparse: true, name: 'subscriber_token_unique' },
    { key: { state: 1, locales: 1 }, name: 'confirmed_by_locale' },
  ])
  await db.collection<BreakingAlertDocument>(BREAKING_ALERTS).createIndexes([
    { key: { sentAt: -1 }, name: 'breaking_recent' },
  ])
  await db.collection<NewsletterDigestDocument>(NEWSLETTER_DIGESTS).createIndexes([
    { key: { sentAt: -1 }, name: 'digest_recent' },
  ])
  await db.collection<PushSubscriptionDocument>(PUSH_SUBSCRIPTIONS).createIndexes([
    { key: { locale: 1 }, name: 'push_by_locale' },
  ])
  await db.collection<RssSourceDocument>(RSS_SOURCES).createIndexes([
    { key: { url: 1 }, unique: true, name: 'rss_url_unique' },
  ])
}
