import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export type TransitionKind = 'submit' | 'approve' | 'reject' | 'schedule' | 'unpublish'

export interface TransitionView {
  readonly id: string
  readonly status: string
  readonly locale: string
  readonly slug: string
}

export async function transitionViaApi(input: {
  readonly baseUrl: string
  readonly userId: string
  readonly kind: TransitionKind
  readonly articleId: string
  readonly revisionId?: string
  readonly note?: string
  readonly at?: Date
  readonly reason?: string
}): Promise<TransitionView> {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Kurasikapa-User': input.userId,
    },
  }
  const payload = bodyFor(input)
  if (payload !== undefined) {
    init.body = payload
  }

  const response = await fetch(joinUrl(input.baseUrl, pathFor(input)), init)

  if (!response.ok) {
    throw await problemFromResponse(response)
  }

  const body = (await response.json()) as Record<string, unknown>
  const id = body['id']
  const status = body['status']
  const locale = body['locale']
  const slug = body['slug']
  if (
    typeof id !== 'string' ||
    typeof status !== 'string' ||
    typeof locale !== 'string' ||
    typeof slug !== 'string'
  ) {
    throw new Error('API returned an unrecognised transition body')
  }

  return { id, status, locale, slug }
}

function pathFor(input: { kind: TransitionKind; articleId: string }): string {
  return `/articles/${input.articleId}/${input.kind}`
}

function bodyFor(input: {
  kind: TransitionKind
  revisionId?: string
  note?: string
  at?: Date
  reason?: string
}): string | undefined {
  if (input.kind === 'submit') return undefined
  if (input.kind === 'approve') {
    return JSON.stringify({ revisionId: input.revisionId ?? '' })
  }
  if (input.kind === 'reject') {
    return JSON.stringify({ note: input.note ?? '' })
  }
  if (input.kind === 'schedule') {
    return JSON.stringify({ at: input.at?.toISOString() ?? '' })
  }
  return JSON.stringify({ reason: input.reason ?? '' })
}
