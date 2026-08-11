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
}

export interface ReadableArticle extends ArticleView {
  readonly body: string | null
}

export interface ListedArticleView extends ArticleView {
  readonly excerpt: string | null
}

export const toArticleView = (article: Article): ArticleView => {
  const props = article.snapshot()

  return {
    id: props.id,
    slug: props.slug.value,
    locale: props.locale,
    title: props.title,
    categoryId: props.categoryId,
    publishedAt: props.publishedAt?.toISOString() ?? null,
  }
}
