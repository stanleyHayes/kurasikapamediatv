'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { ActionResult } from '../../actions/result'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface Autosave {
  readonly state: SaveState
  readonly message: string | null
  /** Call on every change. The write is debounced, not fired per keystroke. */
  touch(): void
}

const DEBOUNCE_MS = 2000

/**
 * Debounced autosave.
 *
 * Debounced rather than throttled: an editor mid-sentence should not trigger a
 * write per keystroke, and the save that matters is the one after they stop.
 * On failure the caller's text is untouched — losing keystrokes is exactly the
 * failure autosave exists to prevent.
 */
export function useAutosave(
  save: () => Promise<ActionResult<unknown>>,
  enabled: boolean,
  /**
   * A single value that changes whenever the tracked content changes.
   *
   * Deliberately one string rather than a spread dependency array: a
   * fixed-size array needs no lint exemption, and the caller decides what
   * "changed" means instead of the hook guessing from identity.
   */
  contentKey: string,
): Autosave {
  const [state, setState] = useState<SaveState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)
  const latest = useRef(save)
  latest.current = save

  const touch = useCallback(() => {
    dirty.current = true
    setState('idle')
  }, [])

  const run = useCallback(() => {
    setState('saving')
    startTransition(async () => {
      const result = await latest.current()

      if (result.ok) {
        dirty.current = false
        setState('saved')
        setMessage(null)
        return
      }

      setState('error')
      setMessage(result.error.message)
    })
  }, [])

  useEffect(() => {
    if (!dirty.current || !enabled) return

    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(run, DEBOUNCE_MS)

    return () => {
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [enabled, run, contentKey])

  return { state, message, touch }
}
