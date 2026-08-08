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
  order: number
}

export const ARTICLES = 'articles'
export const REVISIONS = 'article_revisions'
export const ROLE_ASSIGNMENTS = 'role_assignments'
export const CATEGORIES = 'categories'
