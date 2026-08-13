/**
 * An error returned by the Go API, shaped like RFC 7807.
 *
 * The `type` is stable and is what `toActionError` turns into an ActionResult
 * code. The title is for humans reading a log or a form message.
 */
export class ApiProblem extends Error {
  constructor(
    readonly type: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiProblem'
  }
}

interface ProblemBody {
  readonly type?: unknown
  readonly title?: unknown
  readonly status?: unknown
}

/**
 * Turn a non-2xx Response into an ApiProblem the action layer can map.
 *
 * A body that is not JSON, or that lacks a `type`, becomes `internal` — better
 * a generic failure than inventing a code from a status alone.
 */
export async function problemFromResponse(response: Response): Promise<ApiProblem> {
  const fallback = new ApiProblem(
    'internal',
    `API request failed (${String(response.status)})`,
  )

  try {
    const body = (await response.json()) as ProblemBody
    if (typeof body.type !== 'string' || body.type === '') return fallback

    const title = typeof body.title === 'string' && body.title !== '' ? body.title : fallback.message
    return new ApiProblem(body.type, title)
  } catch {
    return fallback
  }
}
