import type { CardArticleView } from '../read-model/article-view'
import { fetchPublic, publicArticleFrom, toArticleViewFromDto } from './public'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

function listedItems(raw: unknown): readonly CardArticleView[] {
  const body = raw as { items?: unknown }
  if (!Array.isArray(body.items)) return []
  return body.items.map((value) => {
    const row = value as { article?: unknown; excerpt?: unknown; readingMinutes?: unknown }
    return {
      ...toArticleViewFromDto(publicArticleFrom(row.article)),
      excerpt: typeof row.excerpt === 'string' ? row.excerpt : null,
      readingMinutes: typeof row.readingMinutes === 'number' ? row.readingMinutes : 1,
    }
  })
}

export async function loadSemanticSearch(
  apiUrl: string,
  locale: string,
  terms: string,
  limit: number,
): Promise<readonly CardArticleView[]> {
  const query = new URLSearchParams({ q: terms, limit: String(limit) })
  return listedItems(await fetchPublic(apiUrl, `/public/${locale}/search?${query.toString()}`))
}

export async function loadSemanticRelated(
  apiUrl: string,
  locale: string,
  articleId: string,
  limit: number,
): Promise<readonly CardArticleView[]> {
  const query = new URLSearchParams({ limit: String(limit) })
  return listedItems(await fetchPublic(apiUrl, `/public/${locale}/articles/${articleId}/related?${query.toString()}`))
}

export async function processSemanticIndex(input: {
  readonly baseUrl: string
  readonly cronSecret: string
}): Promise<unknown> {
  const response = await fetch(joinUrl(input.baseUrl, '/internal/process-semantic-index'), {
    method: 'POST', headers: { Authorization: `Bearer ${input.cronSecret}` },
  })
  if (!response.ok) throw await problemFromResponse(response)
  return response.json() as Promise<unknown>
}
