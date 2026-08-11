import type { ArticleStatus } from '@kurasikapa/domain'

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

export interface CommentDocument {
  _id: string
  articleId: string
  readerId: string
  body: string
  state: string
  createdAt: Date
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

export const ARTICLES = 'articles'
export const REVISIONS = 'article_revisions'
export const ROLE_ASSIGNMENTS = 'role_assignments'
export const CATEGORIES = 'categories'
export const BOOKMARKS = 'bookmarks'
export const COMMENTS = 'comments'
export const SOCIAL_POSTS = 'social_posts'
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
