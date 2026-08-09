import type { Article, ArticleStatus } from '@kurasikapa/domain'

/**
 * What the studio list renders. Distinct from ArticleView: the CMS cares about
 * workflow state and recency, the public site cares about neither.
 */
export interface DraftView {
  readonly id: string
  readonly title: string
  readonly slug: string
  readonly locale: string
  readonly status: ArticleStatus
  readonly publishedAt: string | null
  readonly scheduledAt: string | null
  readonly categoryId: string
  /**
   * Opening of the LATEST revision — the work in progress, not the approved
   * text. Null when the article has no revision history yet.
   */
  readonly excerpt: string | null
}

/**
 * `excerpt` is required, not defaulted.
 *
 * A default made `.map(toDraftView)` compile while silently passing the array
 * index as the excerpt. Requiring it turns every call site into a decision the
 * compiler checks.
 */
export const toDraftView = (article: Article, excerpt: string | null): DraftView => {
  const props = article.snapshot()

  return {
    categoryId: props.categoryId,
    excerpt,
    id: props.id,
    title: props.title,
    slug: props.slug.value,
    locale: props.locale,
    status: props.status,
    publishedAt: props.publishedAt?.toISOString() ?? null,
    scheduledAt: props.scheduledAt?.toISOString() ?? null,
  }
}

/**
 * Order the newsroom actually works in: things needing attention first, then
 * work in flight, then what is already done. Alphabetical or purely
 * chronological ordering buries the rejected draft nobody has picked up.
 */
const PRIORITY: Readonly<Record<ArticleStatus, number>> = {
  in_review: 0,
  draft: 1,
  approved: 2,
  scheduled: 3,
  unpublished: 4,
  published: 5,
}

export const byWorkflowPriority = (a: DraftView, b: DraftView): number =>
  PRIORITY[a.status] - PRIORITY[b.status]
