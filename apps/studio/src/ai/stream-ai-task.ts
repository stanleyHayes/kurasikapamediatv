import { readTextStream } from './read-text-stream'

/**
 * POST to a streaming AI task and return the full text as it arrives.
 *
 * Errors from the route (401, 429, 400) become Error messages the panel can
 * show. A network failure does the same. The caller owns abort via `signal`.
 */
export async function streamAiTask(
  task: 'draft' | 'bullets' | 'rewrite' | 'tone',
  body: unknown,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`/api/ai/${task}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  })

  if (!response.ok) {
    throw new Error(await failureMessage(response))
  }

  if (response.body === null) {
    throw new Error('The model returned an empty stream.')
  }

  return readTextStream(response.body, onChunk)
}

async function failureMessage(response: Response): Promise<string> {
  if (response.status === 429) return 'Too many AI requests. Wait a moment and try again.'
  if (response.status === 401 || response.status === 403) {
    return 'Sign in again to use AI assists.'
  }

  const text = (await response.text()).trim()
  return text === '' ? `AI request failed (${String(response.status)}).` : text
}
