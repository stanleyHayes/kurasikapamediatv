import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useRewrite } from './use-rewrite'

function streamResponse(chunks: readonly string[]): Response {
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
    { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )
}

const PROPS = {
  title: 'Budget 2026 Explained',
  body: 'The finance minister presented the budget.',
  locale: 'en',
  editable: true,
} as const

describe('useRewrite', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses to run without an instruction', () => {
    const { result } = renderHook(() => useRewrite({ ...PROPS, onUseBody: vi.fn() }))

    expect(result.current.canRun).toBe(false)
  })

  it('streams a rewrite proposal without writing the article', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(['Tight ', 'lead']))
    const onUseBody = vi.fn()

    const { result } = renderHook(() => useRewrite({ ...PROPS, onUseBody }))

    act(() => {
      result.current.setInstruction('Tighten the lead.')
    })

    expect(result.current.canRun).toBe(true)

    act(() => {
      result.current.run()
    })

    await waitFor(() => {
      expect(result.current.proposal).toBe('Tight lead')
      expect(result.current.streaming).toBe(false)
    })

    expect(onUseBody).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/rewrite',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          title: PROPS.title,
          body: PROPS.body,
          locale: 'en',
          instruction: 'Tighten the lead.',
        }),
      }),
    )
  })

  it('posts tone changes to the tone task', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(['calmer']))

    const { result } = renderHook(() => useRewrite({ ...PROPS, onUseBody: vi.fn() }))

    act(() => {
      result.current.setMode('tone')
      result.current.setTone('formal')
    })

    // Tone needs no instruction — the source body is the whole input.
    expect(result.current.canRun).toBe(true)

    act(() => {
      result.current.run()
    })

    await waitFor(() => {
      expect(result.current.proposal).toBe('calmer')
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/tone',
      expect.objectContaining({
        body: JSON.stringify({
          title: PROPS.title,
          body: PROPS.body,
          locale: 'en',
          tone: 'formal',
        }),
      }),
    )
  })

  it('always confirms before replacing the body it rewrote', async () => {
    // A rewrite always has a source body, so acceptance always passes the
    // overwrite warning — replacing the article is a bigger act than filling
    // an empty editor.
    fetchMock.mockResolvedValueOnce(streamResponse(['replacement']))
    const onUseBody = vi.fn()

    const { result } = renderHook(() => useRewrite({ ...PROPS, onUseBody }))

    act(() => {
      result.current.setInstruction('Tighten.')
      result.current.run()
    })

    await waitFor(() => {
      expect(result.current.proposal).toBe('replacement')
    })

    act(() => {
      result.current.accept()
    })

    expect(result.current.confirmOverwrite).toBe(true)
    expect(onUseBody).not.toHaveBeenCalled()

    act(() => {
      result.current.accept()
    })

    expect(onUseBody).toHaveBeenCalledWith('replacement')
  })

  it('refuses to run on an empty body — there is nothing to rewrite', () => {
    const { result } = renderHook(() =>
      useRewrite({ ...PROPS, body: '   ', onUseBody: vi.fn() }),
    )

    act(() => {
      result.current.setInstruction('Tighten.')
    })

    expect(result.current.canRun).toBe(false)
  })

  it('surfaces a 429 as a readable error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Too many', { status: 429 }))

    const { result } = renderHook(() => useRewrite({ ...PROPS, onUseBody: vi.fn() }))

    act(() => {
      result.current.setInstruction('Tighten.')
      result.current.run()
    })

    await waitFor(() => {
      expect(result.current.error).toContain('Too many AI requests')
      expect(result.current.streaming).toBe(false)
    })
  })
})
