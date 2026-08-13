'use client'

import { useReducer, useRef } from 'react'
import {
  useStreamProposal,
  type StreamProposalProps,
  type TaskCall,
} from './use-stream-proposal'

type Mode = 'prompt' | 'bullets'

export interface GeneratePanelProps extends StreamProposalProps {
  readonly locale: string
}

interface Fields {
  mode: Mode
  prompt: string
  bulletsText: string
}

type Action =
  | { type: 'mode'; mode: Mode }
  | { type: 'prompt'; value: string }
  | { type: 'bullets'; value: string }

const INITIAL: Fields = {
  mode: 'prompt',
  prompt: '',
  bulletsText: '',
}

function reduce(state: Fields, action: Action): Fields {
  switch (action.type) {
    case 'mode':
      return { ...state, mode: action.mode }
    case 'prompt':
      return { ...state, prompt: action.value }
    case 'bullets':
      return { ...state, bulletsText: action.value }
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
 * The stream itself lives in useStreamProposal; this hook is the form: which
 * mode, what input, and how that input becomes a task call. Collapsing
 * generate and accept into one call would write model output into the article
 * without a human step (product rule 1).
 */
export function useGenerate(input: GeneratePanelProps): GenerateState {
  const [fields, dispatch] = useReducer(reduce, INITIAL)
  // generate must see the latest fields even when called in the same event as
  // a setter (setMode then generate). Dispatch alone is async to the next
  // render; the ref is updated synchronously in every setter below.
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields

  const stream = useStreamProposal(input)

  return {
    ...fields,
    ...stream,
    canGenerate: canStart(input.editable, stream.streaming, fields),
    setMode: (mode) => {
      fieldsRef.current = { ...fieldsRef.current, mode }
      dispatch({ type: 'mode', mode })
    },
    setPrompt: (value) => {
      fieldsRef.current = { ...fieldsRef.current, prompt: value }
      dispatch({ type: 'prompt', value })
    },
    setBulletsText: (value) => {
      fieldsRef.current = { ...fieldsRef.current, bulletsText: value }
      dispatch({ type: 'bullets', value })
    },
    generate: () => {
      const call = taskFor(fieldsRef.current, input.locale)
      if (call !== null) stream.start(call)
    },
  }
}

function canStart(editable: boolean, streaming: boolean, fields: Fields): boolean {
  if (!editable || streaming) return false
  return fields.mode === 'prompt'
    ? fields.prompt.trim() !== ''
    : parseBullets(fields.bulletsText).length > 0
}

function parseBullets(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * Turns the form into the wire shape the route's schema expects.
 *
 * The port keeps prompt and bullets as separate methods (different prompts,
 * same model), so the wire shapes stay separate too — see the comment on the
 * schemas. A null return means canStart said no; generate treats it as a no-op.
 */
function taskFor(fields: Fields, locale: string): TaskCall | null {
  if (fields.mode === 'prompt') {
    const prompt = fields.prompt.trim()
    return prompt === '' ? null : { task: 'draft', body: { prompt, locale } }
  }

  const bullets = parseBullets(fields.bulletsText)
  return bullets.length === 0 ? null : { task: 'bullets', body: { bullets, locale } }
}
