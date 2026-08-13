import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useGenerate } from './use-generate'

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

describe('useGenerate', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses to generate with an empty prompt', () => {
    const { result } = renderHook(() =>
      useGenerate({
        locale: 'en',
        editable: true,
        currentBody: '',
        onUseBody: vi.fn(),
      }),
    )

    expect(result.current.canGenerate).toBe(false)
  })

  it('streams a proposal from a prompt without writing the article', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(['Hel', 'lo world']))
    const onUseBody = vi.fn()

    const { result } = renderHook(() =>
      useGenerate({
        locale: 'en',
        editable: true,
        currentBody: '',
        onUseBody,
      }),
    )

    act(() => {
      result.current.setPrompt('Cedi rally')
    })

    expect(result.current.canGenerate).toBe(true)

    act(() => {
      result.current.generate()
    })

    await waitFor(() => {
      expect(result.current.proposal).toBe('Hello world')
      expect(result.current.streaming).toBe(false)
    })

    expect(onUseBody).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/draft',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ prompt: 'Cedi rally', locale: 'en' }),
      }),
    )
  })

  it('accepts into the editor only after the editor clicks Use', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(['draft body']))
    const onUseBody = vi.fn()

    const { result } = renderHook(() =>
      useGenerate({
        locale: 'en',
        editable: true,
        currentBody: '',
        onUseBody,
      }),
    )

    act(() => {
      result.current.setPrompt('topic')
      result.current.generate()
    })

    await waitFor(() => {
      expect(result.current.proposal).toBe('draft body')
    })

    act(() => {
      result.current.accept()
    })

    expect(onUseBody).toHaveBeenCalledWith('draft body')
    expect(result.current.proposal).toBe('')
  })

  it('asks before overwriting existing body text', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(['replacement']))
    const onUseBody = vi.fn()

    const { result } = renderHook(() =>
      useGenerate({
        locale: 'en',
        editable: true,
        currentBody: 'existing copy',
        onUseBody,
      }),
    )

    act(() => {
      result.current.setPrompt('topic')
      result.current.generate()
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

  it('posts bullets to the bullets task', async () => {
    fetchMock.mockResolvedValueOnce(streamResponse(['from notes']))

    const { result } = renderHook(() =>
      useGenerate({
        locale: 'fr',
        editable: true,
        currentBody: '',
        onUseBody: vi.fn(),
      }),
    )

    act(() => {
      result.current.setMode('bullets')
      result.current.setBulletsText('rate cut\ninflation')
      result.current.generate()
    })

    await waitFor(() => {
      expect(result.current.proposal).toBe('from notes')
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/bullets',
      expect.objectContaining({
        body: JSON.stringify({ bullets: ['rate cut', 'inflation'], locale: 'fr' }),
      }),
    )
  })

  it('surfaces a 429 as a readable error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Too many', { status: 429 }))

    const { result } = renderHook(() =>
      useGenerate({
        locale: 'en',
        editable: true,
        currentBody: '',
        onUseBody: vi.fn(),
      }),
    )

    act(() => {
      result.current.setPrompt('topic')
      result.current.generate()
    })

    await waitFor(() => {
      expect(result.current.error).toContain('Too many AI requests')
      expect(result.current.streaming).toBe(false)
    })
  })
})
