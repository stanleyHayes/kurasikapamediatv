import type { ClockPort } from '@kurasikapa/application'
import {
  Article,
  type ArticleProps,
  Revision,
  Slug,
  articleId,
  categoryId,
  familyId,
  revisionId,
  userId,
} from '@kurasikapa/domain'

export const NOW = new Date('2026-08-08T10:00:00Z')
export const AUTHOR = userId('usr_author')
export const BUSINESS = categoryId('cat_business')
export const SPORTS = categoryId('cat_sports')

export const fixedClock = (at: Date = NOW): ClockPort => ({ now: () => at })

interface Overrides extends Partial<Omit<ArticleProps, 'id' | 'familyId' | 'slug'>> {
  readonly id?: string
  readonly familyId?: string
  readonly slug?: string
}

export const article = (over: Overrides = {}): Article => {
  // The three string-shaped overrides need converting; the rest spread as-is.
  // A `??` per field would push this past the complexity gate for no benefit.
  const { id: rawId, familyId: rawFamily, slug: rawSlug, ...rest } = over
  const id = rawId ?? 'art_1'

  return Article.reconstitute({
    id: articleId(id),
    familyId: familyId(rawFamily ?? `fam_${id}`),
    slug: Slug.of(rawSlug ?? id.replace(/_/gu, '-')),
    locale: 'en',
    title: 'Budget 2026',
    authorId: AUTHOR,
    categoryId: BUSINESS,
    tagIds: [],
    status: 'draft',
    approvedRevisionId: null,
    scheduledAt: null,
    publishedAt: null,
    ...rest,
  })
}

/** A published article, ordered by the timestamp you give it. */
export const published = (id: string, at: Date, over: Overrides = {}): Article =>
  article({ ...over, id, status: 'published', publishedAt: at })

export const revision = (id: string, forArticle: string, seq: number, body = 'body'): Revision =>
  Revision.reconstitute({
    id: revisionId(id),
    articleId: articleId(forArticle),
    seq,
    title: 'Budget 2026',
    body,
    authorId: AUTHOR,
    createdAt: NOW,
  })
