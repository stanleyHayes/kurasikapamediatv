import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface PublishedItem {
  readonly id: string
  readonly slug: string
  readonly locale: string
}

export interface PublishDueResult {
  readonly published: readonly PublishedItem[]
  readonly failed: readonly { articleId: string; reason: string }[]
}

/**
 * Ask Go to publish every due scheduled article.
 *
 * Forwards the same Bearer secret Vercel Cron sent Next — Go guards with the
 * identical CRON_SECRET. The Next route stays the cron entrypoint so vercel.json
 * does not change.
 */
export async function publishDueViaApi(input: {
  readonly baseUrl: string
  readonly cronSecret: string
}): Promise<PublishDueResult> {
  const response = await fetch(joinUrl(input.baseUrl, '/internal/publish-due'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.cronSecret}` },
  })

  if (!response.ok && response.status !== 207) {
    throw await problemFromResponse(response)
  }

  return readDueResult(response)
}

async function readDueResult(response: Response): Promise<PublishDueResult> {
  const body = (await response.json()) as {
    published?: unknown
    failed?: unknown
  }

  return {
    published: parsePublished(body.published),
    failed: parseFailed(body.failed),
  }
}

function parsePublished(value: unknown): readonly PublishedItem[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const row = item as { id?: unknown; slug?: unknown; locale?: unknown }
    if (typeof row.id !== 'string' || typeof row.slug !== 'string' || typeof row.locale !== 'string') {
      return []
    }

    return [{ id: row.id, slug: row.slug, locale: row.locale }]
  })
}

function parseFailed(value: unknown): readonly { articleId: string; reason: string }[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const row = item as { articleId?: unknown; reason?: unknown }
    if (typeof row.articleId !== 'string' || typeof row.reason !== 'string') return []

    return [{ articleId: row.articleId, reason: row.reason }]
  })
}
