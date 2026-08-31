import type { ArticleStatus, BroadcastState, RevisionTrigger } from '@kurasikapa/domain'

export const INVITATIONS = 'user_invitations'

export interface InvitationDocument {
  _id: string
  email: string
  name: string
  roles: string[]
  tokenHash: string
  invitedBy: string
  createdAt: Date
  expiresAt: Date
  state: string
}

/**
 * The shape on disk. Deliberately not the domain shape.
 *
 * `_id` is our own branded id string, not an ObjectId — ids are minted by
 * IdPort so the domain owns identity, and a meaningful id survives an export.
 */
export interface ArticleDocument {
  _id: string
  familyId: string
  locale: string
  slug: string
  title: string
  authorId: string
  categoryId: string
  tagIds: string[]
  hero?: {
    assetId: string
    secureUrl: string
    altText: string
    caption: string
    credit: string
    width: number
    height: number
  }
  status: ArticleStatus
  approvedRevisionId: string | null
  scheduledAt: Date | null
  publishedAt: Date | null
  /**
   * Persistence metadata, not a domain concept. Exists so the CMS can sort
   * "my drafts" by recency without the domain having to model a field no
   * business rule reads.
   */
  updatedAt: Date
}

export interface RevisionDocument {
  _id: string
  articleId: string
  seq: number
  title: string
  body: string
  authorId: string
  createdAt: Date
  /** Why the revision exists. Optional — older documents predate the field. */
  trigger?: RevisionTrigger
}

export interface RoleAssignmentDocument {
  /** The auth library's user id. We store roles against it, never inside it. */
  _id: string
  roles: string[]
}

export interface CategoryDocument {
  _id: string
  parentId: string | null
  slugs: Record<string, string>
  names: Record<string, string>
  /** Optional and per-locale — older documents predate the field. */
  descriptions?: Record<string, string>
  order: number
}

export interface BookmarkDocument {
  /** `${readerId}:${articleId}` — a reader cannot save the same article twice. */
  _id: string
  readerId: string
  articleId: string
  locale: string
  savedAt: Date
}

export interface ReadingDocument {
  /** `${readerId}:${articleId}` — one row per reader per article, last visit wins. */
  _id: string
  readerId: string
  articleId: string
  locale: string
  readAt: Date
}

export interface PageViewDocument {
  _id: string
  articleId: string
  locale: string
  visitorHash: string
  channel: string
  occurredAt: Date
}

export interface LikeDocument {
  /** `${readerId}:${articleId}` — a reader cannot like the same article twice. */
  _id: string
  readerId: string
  articleId: string
  likedAt: Date
}

export interface CommentDocument {
  _id: string
  articleId: string
  readerId: string
  body: string
  state: string
  createdAt: Date
}

export interface NewsletterDocument {
  _id: string
  email: string
  locales: string[]
  cadence: string
  state: string
  token: string | null
  confirmedAt: Date | null
}

export interface PushSubscriptionDocument {
  _id: string
  p256dh: string
  auth: string
  locale: string
  subscribedAt: Date
}

export interface RssSourceDocument {
  _id: string
  url: string
  locale: string
  categoryId: string
  etag: string | null
  lastFetchedAt: Date | null
  seenGuids: string[]
}

export interface BreakingAlertDocument {
  /** Article id — one blast per story. */
  _id: string
  locale: string
  actorId: string
  sentAt: Date
}

export interface NewsletterDigestDocument {
  /** `${cadence}:${locale}:${periodKey}` — one send per period. */
  _id: string
  cadence: string
  locale: string
  periodKey: string
  sentAt: Date
  articleCount: number
  recipientCount: number
}

export interface SocialPostDocument {
  _id: string
  articleId: string
  platform: string
  caption: string
  scheduledAt: Date
  state: string
  attempts: number
  lastError: string | null
  createdBy: string
}

/**
 * One live transmission on disk. Mirrors `BroadcastProps` field for field.
 *
 * **There is no `streamKey`, and adding one is not a refactor.** The key is the
 * credential that lets its holder broadcast as the station; the aggregate never
 * holds it and `LiveVideoPort` hands it back exactly once, at provision time.
 * Absent beats hashed here — a hash is only useful to verify a key someone
 * presents, and nothing in this system ever does that, so the field would be a
 * permanent copy of a secret in every nightly backup earning nothing. If a
 * future feature needs to re-show it, that is the provider's rotate call, not a
 * column.
 *
 * `channelArn` is not a secret but is not a reader's business either: it is the
 * handle an attacker enumerates the station's AWS estate with. It lives here
 * because EndBroadcast needs it to tear the channel down — a channel with no row
 * pointing at it bills forever — and `GetCurrentBroadcast` projects it away.
 */
export interface BroadcastDocument {
  _id: string
  title: string
  /** Its own locale, like an article's. Product rule 3: locale is data. */
  locale: string
  channelArn: string
  playbackUrl: string
  state: BroadcastState
  scheduledFor: Date
  startedAt: Date | null
  endedAt: Date | null
  createdBy: string
}

export const ARTICLES = 'articles'
export const REVISIONS = 'article_revisions'
export const ROLE_ASSIGNMENTS = 'role_assignments'
export const CATEGORIES = 'categories'
export const BOOKMARKS = 'bookmarks'
export const LIKES = 'likes'
export const READINGS = 'readings'
export const PAGE_VIEWS = 'page_views'
export const COMMENTS = 'comments'
export const NEWSLETTER_SUBSCRIBERS = 'newsletter_subscribers'
export const BREAKING_ALERTS = 'breaking_alerts'
export const NEWSLETTER_DIGESTS = 'newsletter_digests'
export const PUSH_SUBSCRIPTIONS = 'push_subscriptions'
export const RSS_SOURCES = 'rss_sources'
export const SOCIAL_POSTS = 'social_posts'
export const BROADCASTS = 'broadcasts'
export const SITE_PAGES = 'site_pages'
/** Append-only. Product rule 4. */
export const AUDIT_ENTRIES = 'audit_entries'
/** Ephemeral counters, reaped by a TTL index. */
export const RATE_LIMITS = 'rate_limits'

export interface AuditEntryDocument {
  _id: string
  action: string
  actorId: string
  subjectId: string
  occurredAt: Date
  detail: Record<string, string>
}

export interface RateLimitDocument {
  /** `${key}:${windowStart}` — a new window is a new document. */
  _id: string
  count: number
  /** TTL anchor. Mongo reaps the document some time after this. */
  expiresAt: Date
}

export interface SitePageDocument { _id: string; key: string; locale: string; title: string; lead: string; body: string; updatedAt: Date }

// --- identity: authentication (KUR-66) ---

export const CREDENTIALS = 'credentials'

/**
 * Better Auth's own collections, read ONLY to migrate off them.
 *
 * It owned sign-in before KUR-66 and every account that exists today lives
 * here, not in `credentials`. Nothing writes to these — the fallback in
 * MongoCredentialRepository reads a row once, and the first successful sign-in
 * writes the native row that supersedes it.
 */
export const LEGACY_USERS = 'user'
export const LEGACY_ACCOUNTS = 'account'
export const LEGACY_TWO_FACTOR = 'twoFactor'
export const REFRESH_TOKENS = 'refresh_tokens'

/**
 * Authentication material, kept apart from the `user` collection the roles
 * screen reads. Nothing that renders a screen should be able to reach a
 * password hash, and two collections is what makes that a type error rather
 * than a code-review note.
 */
export interface ExternalIdentityDocument {
  readonly provider: 'google' | 'facebook' | 'apple'
  readonly subject: string
  readonly linkedAt: Date
}

export interface TotpDocument {
  readonly secret: string
  readonly lastUsedCounter: number | null
  readonly recoveryCodeHashes: readonly string[]
  readonly enrolledAt: Date
}

export interface CredentialDocument {
  /** The user id. One credential per user, so the id IS the key. */
  readonly _id: string
  /** Normalised (trimmed, lowercased) by the domain before it reaches here. */
  readonly email: string
  readonly passwordHash: string | null
  readonly externals: readonly ExternalIdentityDocument[]
  readonly totp: TotpDocument | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface RefreshTokenDocument {
  readonly _id: string
  readonly sessionId: string
  readonly userId: string
  /** SHA-256 of the token. The token itself is never stored. */
  readonly tokenHash: string
  readonly state: 'active' | 'rotated' | 'revoked'
  readonly expiresAt: Date
  readonly createdAt: Date
}
