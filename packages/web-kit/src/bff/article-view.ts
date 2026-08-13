export interface ArticleView {
  readonly id: string
  readonly slug: string
  readonly locale: string
}

/** Parse the Go articleView JSON into the fields the BFF needs. */
export async function readArticleView(
  response: Response,
  fallbackLocale = '',
): Promise<ArticleView> {
  const body = (await response.json()) as { slug?: unknown; id?: unknown; locale?: unknown }
  if (typeof body.slug !== 'string' || typeof body.id !== 'string') {
    throw new Error('Article response was missing id or slug')
  }

  const locale = typeof body.locale === 'string' ? body.locale : fallbackLocale
  if (locale === '') {
    throw new Error('Article response was missing locale')
  }

  return { id: body.id, slug: body.slug, locale }
}
