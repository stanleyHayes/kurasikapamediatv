import type { Db } from 'mongodb'
import { ensureTelevisionIndexes } from './television-indexes'
import {
  ARTICLES,
  AUDIT_ENTRIES,
  BOOKMARKS,
  BROADCASTS,
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
  RATE_LIMITS,
  CREDENTIALS,
  REFRESH_TOKENS,
  REVISIONS,
  type ArticleDocument,
  type BookmarkDocument,
  type BroadcastDocument,
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
  type CredentialDocument,
  type RefreshTokenDocument,
  INVITATIONS,
  type InvitationDocument,
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
  await ensureMediaIndexes(db)

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

async function ensureMediaIndexes(db: Db): Promise<void> {
  await ensureBroadcastIndexes(db)
  await ensureTelevisionIndexes(db)
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
    { key: { token: 1 }, unique: true, name: 'subscriber_token_unique', partialFilterExpression: { token: { $type: 'string' } } },
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
  // The TTL index that stops the rate-limit collection growing without bound.
  // Mongo's TTL monitor runs about once a minute, so documents outlive their
  // window slightly. That is harmless: the window id already makes an expired
  // document unreachable, and the index is housekeeping rather than correctness.
  await db.collection(RATE_LIMITS).createIndexes([
    { key: { expiresAt: 1 }, name: 'rate_limit_ttl', expireAfterSeconds: 0 },
  ])
  await db.collection<InvitationDocument>(INVITATIONS).createIndexes([
    { key: { tokenHash: 1 }, unique: true, name: 'invitation_token_unique' },
    { key: { email: 1 }, unique: true, name: 'one_pending_invitation_per_email', partialFilterExpression: { state: 'pending' } },
    { key: { createdAt: -1 }, name: 'invitation_recent' },
  ])

  /*
   * Authentication (KUR-66).
   *
   * The unique index on `email` is not an optimisation — it is the ONLY thing
   * that stops two concurrent sign-ups from both creating an account for the
   * same address. MongoCredentialRepository relies on it throwing.
   */
  await db
    .collection<CredentialDocument>(CREDENTIALS)
    .createIndex({ email: 1 }, { unique: true, name: 'credentials_email_unique' })

  await ensureAudienceIndexesPart2(db)
}

/**
 * Split purely to stay under the 50-line function cap. The two halves have no
 * ordering relationship — indexes are independent — so the seam is arbitrary
 * and deliberately named as such rather than pretending to be a boundary.
 */
async function ensureAudienceIndexesPart2(db: Db): Promise<void> {

  // Provider lookups go through the immutable subject, never the email.
  await db
    .collection<CredentialDocument>(CREDENTIALS)
    .createIndex(
      { 'externals.provider': 1, 'externals.subject': 1 },
      { name: 'credentials_external_identity' },
    )

  // Every refresh redeems by hash, so this one is on the hot path.
  await db
    .collection<RefreshTokenDocument>(REFRESH_TOKENS)
    .createIndex({ tokenHash: 1 }, { unique: true, name: 'refresh_token_hash_unique' })

  // Revoking a family, and revoking every session a user has.
  await db
    .collection<RefreshTokenDocument>(REFRESH_TOKENS)
    .createIndex({ sessionId: 1 }, { name: 'refresh_token_session' })
  await db
    .collection<RefreshTokenDocument>(REFRESH_TOKENS)
    .createIndex({ userId: 1 }, { name: 'refresh_token_user' })

  /*
   * Expired tokens delete themselves 30 days after they lapse.
   *
   * The delay is deliberate: a spent token must outlive its own expiry for
   * reuse detection to still recognise a replay rather than shrugging at an
   * unknown hash.
   */
  await db
    .collection<RefreshTokenDocument>(REFRESH_TOKENS)
    .createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'refresh_token_ttl' },
    )
}

export async function ensureBroadcastIndexes(db: Db): Promise<void> {
  await db.collection<BroadcastDocument>(BROADCASTS).createIndexes([
    // "Is this locale on air?" — the homepage asks it on every request, for
    // everyone, so it is the one broadcast query a reader can trigger and the
    // one that must not read the archive to answer.
    //
    // Partial on `state`, keyed on `locale` alone. The filter is what keeps it
    // correct *and* fast as the collection ages: the index holds only the rows
    // that are live — never more than one per locale — so it is the same size
    // in year three as on day one, while a plain `{ locale, state }` compound
    // would carry an entry for every broadcast the station ever ran. Mongo can
    // use it because `currentLive` queries `state: 'live'` literally; a query
    // that widened that predicate would silently fall back to a scan.
    //
    // `unique` is the point of the index, not a bonus. StartBroadcast reads
    // `currentLive`, sees null, provisions a channel and then writes — and two
    // operators pressing "go live" in the same second both read null. Without
    // this, both rows say `live`, two channels bill by the hour and the front
    // page plays whichever the sort happens to reach. Here the second write
    // fails with a duplicate key, and StartBroadcast's teardown removes the
    // channel it had already provisioned. The rule belongs to the domain; this
    // is the only place it can be held across two concurrent requests.
    //
    // Ended and scheduled rows sit outside the filter, so a locale keeps as
    // much history as it likes and may line up tomorrow's bulletin while
    // tonight's is still on air.
    {
      key: { locale: 1 },
      unique: true,
      name: 'broadcast_live_per_locale_unique',
      partialFilterExpression: { state: 'live' },
    },
    // The studio list: one locale, newest scheduled first. `_id` breaks the tie
    // so two broadcasts scheduled for the same minute keep a stable order
    // instead of swapping places between two loads of the same screen.
    { key: { locale: 1, scheduledFor: -1, _id: -1 }, name: 'broadcast_by_locale_recent' },
  ])
}
