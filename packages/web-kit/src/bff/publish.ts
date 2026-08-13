import { problemFromResponse } from './problem'
import { readArticleView, type ArticleView } from './article-view'
import { joinUrl } from './url'

/** Publish an approved article through the Go API. */
export async function publishViaApi(input: {
  readonly baseUrl: string
  readonly userId: string
  readonly articleId: string
}): Promise<ArticleView> {
  const response = await fetch(joinUrl(input.baseUrl, `/articles/${input.articleId}/publish`), {
    method: 'POST',
    headers: { 'X-Kurasikapa-User': input.userId },
  })

  if (!response.ok) {
    throw await problemFromResponse(response)
  }

  return readArticleView(response)
}
