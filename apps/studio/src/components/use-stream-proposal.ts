'use client'

import { useEffect, useReducer, useRef } from 'react'
import { streamAiTask } from '../ai/stream-ai-task'

export interface StreamProposalProps {
  readonly editable: boolean
  /** Current editor body — used only to warn before overwrite. */
  readonly currentBody: string
  /**
   * Puts the proposal into the editor's own field. Acceptance is theirs alone;
   * autosave then treats it like any other edit. ADR-0005 / product rule 1.
   */
  readonly onUseBody: (body: string) => void
}

/** One streaming call: which task, and the body its schema expects. */
export interface TaskCall {
  readonly task: 'draft' | 'bullets' | 'rewrite' | 'tone'
  readonly body: unknown
}

interface Fields {
  proposal: string
  streaming: boolean
  error: string | null
  confirmOverwrite: boolean
}

type Action =
  | { type: 'chunk'; chunk: string }
  | { type: 'reset-proposal' }
  | { type: 'finished' }
  | { type: 'error'; message: string }
  | { type: 'confirm'; value: boolean }
  | { type: 'clear-after-accept' }

const INITIAL: Fields = {
  proposal: '',
  streaming: false,
  error: null,
  confirmOverwrite: false,
}

function reduce(state: Fields, action: Action): Fields {
  switch (action.type) {
    case 'chunk':
      return { ...state, proposal: state.proposal + action.chunk }
    case 'reset-proposal':
      return { ...state, proposal: '', error: null, confirmOverwrite: false, streaming: true }
    case 'finished':
      return { ...state, streaming: false }
    case 'error':
      return { ...state, error: action.message }
    case 'confirm':
      return { ...state, confirmOverwrite: action.value }
    case 'clear-after-accept':
      return { ...state, proposal: '', confirmOverwrite: false }
  }
}

export interface StreamProposal {
  readonly proposal: string
  readonly streaming: boolean
  readonly error: string | null
  readonly confirmOverwrite: boolean
  readonly start: (call: TaskCall) => void
  readonly accept: () => void
  readonly cancelOverwrite: () => void
}

/**
 * The propose-then-accept core every streaming assist shares.
 *
 * Generation, rewrite and tone differ only in which task they start and what
 * body they send; the stream handling, the overwrite warning and the rule
 * that nothing reaches the article before the editor clicks Use are the same
 * for all of them. Keeping them here means a new streaming assist is a form
 * and a task call, not a third copy of an AbortController.
 */
export function useStreamProposal(input: StreamProposalProps): StreamProposal {
  const [state, dispatch] = useReducer(reduce, INITIAL)
  const abortRef = useRef<AbortController | null>(null)
  // accept must see the latest proposal even in the same event as a chunk;
  // dispatch alone is async to the next render.
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => () => abortRef.current?.abort(), [])

  return {
    ...state,
    start: (call) => {
      startStream(call, abortRef, dispatch)
    },
    accept: () => {
      acceptProposal(stateRef.current, input, dispatch)
    },
    cancelOverwrite: () => {
      dispatch({ type: 'confirm', value: false })
    },
  }
}

function acceptProposal(
  state: Fields,
  input: StreamProposalProps,
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

function startStream(
  call: TaskCall,
  abortRef: React.RefObject<AbortController | null>,
  dispatch: React.Dispatch<Action>,
): void {
  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller

  dispatch({ type: 'reset-proposal' })

  void streamAiTask(
    call.task,
    call.body,
    (chunk) => {
      dispatch({ type: 'chunk', chunk })
    },
    controller.signal,
  )
    .catch((caught: unknown) => {
      if (controller.signal.aborted) return
      dispatch({
        type: 'error',
        message: caught instanceof Error ? caught.message : 'The AI request failed.',
      })
    })
    .finally(() => {
      if (!controller.signal.aborted) dispatch({ type: 'finished' })
    })
}
