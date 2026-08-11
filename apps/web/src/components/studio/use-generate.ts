'use client'

import { useEffect, useReducer, useRef } from 'react'
import { streamAiTask } from '../../ai/stream-ai-task'

type Mode = 'prompt' | 'bullets'

export interface GeneratePanelProps {
  readonly locale: string
  readonly editable: boolean
  /** Current editor body — used only to warn before overwrite. */
  readonly currentBody: string
  /**
   * Puts the proposal into the editor's own field. Acceptance is theirs alone;
   * autosave then treats it like any other edit. ADR-0005 / product rule 1.
   */
  readonly onUseBody: (body: string) => void
}

interface Fields {
  mode: Mode
  prompt: string
  bulletsText: string
  proposal: string
  streaming: boolean
  error: string | null
  confirmOverwrite: boolean
}

type Action =
  | { type: 'mode'; mode: Mode }
  | { type: 'prompt'; value: string }
  | { type: 'bullets'; value: string }
  | { type: 'chunk'; chunk: string }
  | { type: 'reset-proposal' }
  | { type: 'streaming'; value: boolean }
  | { type: 'error'; message: string | null }
  | { type: 'confirm'; value: boolean }
  | { type: 'clear-after-accept' }

const INITIAL: Fields = {
  mode: 'prompt',
  prompt: '',
  bulletsText: '',
  proposal: '',
  streaming: false,
  error: null,
  confirmOverwrite: false,
}

function reduce(state: Fields, action: Action): Fields {
  switch (action.type) {
    case 'mode':
      return { ...state, mode: action.mode }
    case 'prompt':
      return { ...state, prompt: action.value }
    case 'bullets':
      return { ...state, bulletsText: action.value }
    case 'chunk':
      return { ...state, proposal: state.proposal + action.chunk }
    case 'reset-proposal':
      return { ...state, proposal: '', error: null, confirmOverwrite: false, streaming: true }
    case 'streaming':
      return { ...state, streaming: action.value }
    case 'error':
      return { ...state, error: action.message }
    case 'confirm':
      return { ...state, confirmOverwrite: action.value }
    case 'clear-after-accept':
      return { ...state, proposal: '', confirmOverwrite: false }
  }
}

export interface GenerateState {
  readonly mode: Mode
  readonly prompt: string
  readonly bulletsText: string
  readonly proposal: string
  readonly streaming: boolean
  readonly error: string | null
  readonly confirmOverwrite: boolean
  readonly canGenerate: boolean
  readonly setMode: (mode: Mode) => void
  readonly setPrompt: (value: string) => void
  readonly setBulletsText: (value: string) => void
  readonly generate: () => void
  readonly accept: () => void
  readonly cancelOverwrite: () => void
}

/**
 * Propose-then-accept for draft generation — same shape as useTranslation.
 *
 * Kept out of the component so the component is layout. Collapsing generate
 * and accept into one call would write model output into the article without
 * a human step (product rule 1).
 */
export function useGenerate(input: GeneratePanelProps): GenerateState {
  const [state, dispatch] = useReducer(reduce, INITIAL)
  const abortRef = useRef<AbortController | null>(null)
  // generate/accept must see the latest fields even when called in the same
  // event as a setter (setMode then generate). Dispatch alone is async to the
  // next render; the ref is updated synchronously in every setter below.
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => () => abortRef.current?.abort(), [])

  return {
    ...state,
    canGenerate: canStart(input.editable, state),
    setMode: (mode) => {
      stateRef.current = { ...stateRef.current, mode }
      dispatch({ type: 'mode', mode })
    },
    setPrompt: (value) => {
      stateRef.current = { ...stateRef.current, prompt: value }
      dispatch({ type: 'prompt', value })
    },
    setBulletsText: (value) => {
      stateRef.current = { ...stateRef.current, bulletsText: value }
      dispatch({ type: 'bullets', value })
    },
    generate: () => {
      startGenerate(stateRef.current, input.locale, abortRef, dispatch)
    },
    accept: () => {
      acceptProposal(stateRef.current, input, dispatch)
    },
    cancelOverwrite: () => {
      dispatch({ type: 'confirm', value: false })
    },
  }
}

function canStart(editable: boolean, state: Fields): boolean {
  if (!editable || state.streaming) return false
  return state.mode === 'prompt'
    ? state.prompt.trim() !== ''
    : parseBullets(state.bulletsText).length > 0
}

function parseBullets(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function acceptProposal(
  state: Fields,
  input: GeneratePanelProps,
  dispatch: React.Dispatch<Action>,
): void {
  if (state.proposal.trim() === '') return

  if (input.currentBody.trim() !== '' && !state.confirmOverwrite) {
    dispatch({ type: 'confirm', value: true })
    return
  }

  input.onUseBody(state.proposal)
  dispatch({ type: 'clear-after-accept' })
}

function startGenerate(
  state: Fields,
  locale: string,
  abortRef: React.RefObject<AbortController | null>,
  dispatch: React.Dispatch<Action>,
): void {
  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller

  dispatch({ type: 'reset-proposal' })

  void runGenerate(state, locale, controller.signal, (chunk) => {
    dispatch({ type: 'chunk', chunk })
  })
    .catch((caught: unknown) => {
      if (controller.signal.aborted) return
      dispatch({
        type: 'error',
        message: caught instanceof Error ? caught.message : 'Generation failed.',
      })
    })
    .finally(() => {
      if (!controller.signal.aborted) dispatch({ type: 'streaming', value: false })
    })
}

async function runGenerate(
  state: Fields,
  locale: string,
  signal: AbortSignal,
  onChunk: (chunk: string) => void,
): Promise<void> {
  if (state.mode === 'prompt') {
    await streamAiTask('draft', { prompt: state.prompt.trim(), locale }, onChunk, signal)
    return
  }

  await streamAiTask(
    'bullets',
    { bullets: parseBullets(state.bulletsText), locale },
    onChunk,
    signal,
  )
}
