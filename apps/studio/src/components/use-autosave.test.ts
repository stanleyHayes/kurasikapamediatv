import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAutosave } from './use-autosave'

const ok = (): Promise<{ ok: true; data: null }> => Promise.resolve({ ok: true as const, data: null })

const failing = (message: string) => (): Promise<{ ok: false; error: { code: string; message: string } }> =>
  Promise.resolve({ ok: false as const, error: { code: 'slug_taken', message } })

describe('useAutosave', () => {
  it('starts idle and saves nothing on mount', async () => {
    const save = vi.fn(ok)
    const { result } = renderHook(() => useAutosave(save, true, 'initial'))

    expect(result.current.state).toBe('idle')
    await new Promise((r) => setTimeout(r, 2100))
    expect(save).not.toHaveBeenCalled()
  })

  it('saves after the content settles', async () => {
    const save = vi.fn(ok)
    const { result, rerender } = renderHook(({ key }) => useAutosave(save, true, key), {
      initialProps: { key: 'a' },
    })

    act(() => {
      result.current.touch()
    })
    rerender({ key: 'b' })

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1)
    }, { timeout: 4000 })
    await waitFor(() => {
      expect(result.current.state).toBe('saved')
    })
  })

  it('debounces a burst into a single write', async () => {
    // An editor mid-sentence must not trigger a write per keystroke.
    const save = vi.fn(ok)
    const { result, rerender } = renderHook(({ key }) => useAutosave(save, true, key), {
      initialProps: { key: 'a' },
    })

    for (const key of ['b', 'c', 'd', 'e']) {
      act(() => {
        result.current.touch()
      })
      rerender({ key })
    }

    await waitFor(() => {
      expect(save).toHaveBeenCalledTimes(1)
    }, { timeout: 4000 })
  })

  it('surfaces a failure without clearing the editor', async () => {
    const save = vi.fn(failing('Slug "budget-2026" is already used in locale "en"'))
    const { result, rerender } = renderHook(({ key }) => useAutosave(save, true, key), {
      initialProps: { key: 'a' },
    })

    act(() => {
      result.current.touch()
    })
    rerender({ key: 'b' })

    await waitFor(() => {
      expect(result.current.state).toBe('error')
    }, { timeout: 4000 })
    expect(result.current.message).toContain('budget-2026')
  })

  it('never saves when editing is disabled', async () => {
    // A published article is read-only. Autosave must not write behind an
    // editor who cannot legitimately edit.
    const save = vi.fn(ok)
    const { result, rerender } = renderHook(({ key }) => useAutosave(save, false, key), {
      initialProps: { key: 'a' },
    })

    act(() => {
      result.current.touch()
    })
    rerender({ key: 'b' })

    await new Promise((r) => setTimeout(r, 2400))
    expect(save).not.toHaveBeenCalled()
  })
})
