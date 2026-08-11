import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { streamAiTask } from './stream-ai-task'

function streamResponse(chunks: readonly string[], status = 200): Response {
  const encoder = new TextEncoder()
  let i = 0

  return new Response(
    new ReadableStream({
      pull(controller) {
        if (i >= chunks.length) {
          controller.close()
          return
        }

        controller.enqueue(encoder.encode(chunks[i]))
        i += 1
      },
    }),
    { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )
}

describe('streamAiTask', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the full text and reports each chunk', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(['a ', 'b']))
    const chunks: string[] = []

    const text = await streamAiTask('draft', { prompt: 'x', locale: 'en' }, (chunk) => {
      chunks.push(chunk)
    })

    expect(text).toBe('a b')
    expect(chunks).toEqual(['a ', 'b'])
  })

  it('explains a rate limit without dumping the status code alone', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 429 }))

    await expect(
      streamAiTask('draft', { prompt: 'x', locale: 'en' }, () => undefined),
    ).rejects.toThrow(/Too many AI requests/)
  })

  it('passes through a 400 body so the editor sees the schema message', async () => {
    fetchMock.mockResolvedValueOnce(new Response('prompt: Too small', { status: 400 }))

    await expect(
      streamAiTask('draft', { prompt: '', locale: 'en' }, () => undefined),
    ).rejects.toThrow('prompt: Too small')
  })
})
