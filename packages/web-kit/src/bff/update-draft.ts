import { actorHeaders } from './actor-headers'
import { problemFromResponse } from './problem'
import { joinUrl } from './url'

export interface UpdateDraftView {
  readonly revisionId: string
  readonly seq: number
  readonly slug: string
}

export async function updateDraftViaApi(input: {
  readonly baseUrl: string
  readonly userId: string
  readonly articleId: string
  readonly title: string
  readonly body: string
}): Promise<UpdateDraftView> {
  const response = await fetch(joinUrl(input.baseUrl, `/articles/${input.articleId}`), {
    method: 'PATCH',
    headers: actorHeaders(input.userId, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title: input.title, body: input.body }),
  })

  if (!response.ok) {
    throw await problemFromResponse(response)
  }

  const body = (await response.json()) as Record<string, unknown>
  const revisionId = body['revisionId']
  const seq = body['seq']
  const slug = body['slug']
  if (typeof revisionId !== 'string' || typeof seq !== 'number' || typeof slug !== 'string') {
    throw new Error('API returned an unrecognised update-draft body')
  }

  return { revisionId, seq, slug }
}
