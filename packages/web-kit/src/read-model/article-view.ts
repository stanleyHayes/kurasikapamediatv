import type { Article } from '@kurasikapa/domain'

/**
 * A plain object a Server Component can render and pass to a Client Component.
 *
 * Domain entities carry behaviour and value objects, neither of which survives
 * the RSC serialisation boundary. Converting once, here, keeps `Article` free
 * of "must be serialisable" pressure it should never feel.
 */
export interface ArticleView {
  readonly id: string
  readonly slug: string
  readonly locale: string
  readonly title: string
  readonly categoryId: string
  readonly publishedAt: string | null
  readonly hero: ArticleHeroView | null
}

export interface ArticleHeroView {
  readonly assetId: string
  readonly secureUrl: string
  readonly altText: string
  readonly caption: string
  readonly credit: string
  readonly width: number
  readonly height: number
}

export interface ReadableArticle extends ArticleView {
  readonly body: string | null
  /** Directory display name, or null when we cannot source one honestly. */
  readonly authorName: string | null
}

export interface CardArticleView extends ArticleView {
  readonly excerpt: string | null
  readonly readingMinutes: number
}

export type ListedArticleView = CardArticleView

export const toArticleView = (article: Article): ArticleView => {
  const props = article.snapshot()

  return {
    id: props.id,
    slug: props.slug.value,
    locale: props.locale,
    title: props.title,
    categoryId: props.categoryId,
    publishedAt: props.publishedAt?.toISOString() ?? null,
    hero: props.hero ?? null,
  }
}
