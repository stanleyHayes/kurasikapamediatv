import { describe, expect, it } from 'vitest'
import { ApiProblem, problemFromResponse } from './problem'

describe('problemFromResponse', () => {
  it('reads a typed problem body', async () => {
    const response = new Response(
      JSON.stringify({ type: 'slug_taken', title: 'Slug taken', status: 409 }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    )

    const problem = await problemFromResponse(response)

    expect(problem).toBeInstanceOf(ApiProblem)
    expect(problem.type).toBe('slug_taken')
    expect(problem.message).toContain('Slug taken')
  })

  it('falls back when the body is not a problem document', async () => {
    const response = new Response('plain failure', { status: 502 })

    const problem = await problemFromResponse(response)

    expect(problem.type).toBe('internal')
    expect(problem.message).toContain('502')
  })
})
