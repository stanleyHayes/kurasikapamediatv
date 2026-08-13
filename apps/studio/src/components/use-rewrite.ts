'use client'

import type { Tone } from '@kurasikapa/application'
import { useReducer, useRef } from 'react'
import { useStreamProposal, type TaskCall } from './use-stream-proposal'

/** The five tones the AiPort accepts — inventing one is a 400, not a model call. */
export const TONES: readonly Tone[] = [
  'neutral',
  'formal',
  'conversational',
  'urgent',
  'analytical',
]

export interface RewritePanelProps {
  readonly title: string
  readonly body: string
  readonly locale: string
  readonly editable: boolean
  /** Puts the proposal into the editor's body field. Acceptance is the editor's. */
  readonly onUseBody: (body: string) => void
}

type Mode = 'rewrite' | 'tone'

interface Fields {
  mode: Mode
  instruction: string
  tone: Tone
}

type Action =
  | { type: 'mode'; mode: Mode }
  | { type: 'instruction'; value: string }
  | { type: 'tone'; tone: Tone }

const INITIAL: Fields = {
  mode: 'rewrite',
  instruction: '',
  tone: 'neutral',
}

function reduce(state: Fields, action: Action): Fields {
  switch (action.type) {
    case 'mode':
      return { ...state, mode: action.mode }
    case 'instruction':
      return { ...state, instruction: action.value }
    case 'tone':
      return { ...state, tone: action.tone }
  }
}

export interface RewriteState {
  readonly mode: Mode
  readonly instruction: string
  readonly tone: Tone
  readonly proposal: string
  readonly streaming: boolean
  readonly error: string | null
  readonly confirmOverwrite: boolean
  readonly canRun: boolean
  readonly setMode: (mode: Mode) => void
  readonly setInstruction: (value: string) => void
  readonly setTone: (tone: Tone) => void
  readonly run: () => void
  readonly accept: () => void
  readonly cancelOverwrite: () => void
}

/**
 * Propose-then-accept for rewriting the draft already in the editor.
 *
 * Unlike generation there is always a source body — it is the thing being
 * rewritten — so accepting a proposal always passes the overwrite warning.
 * That is deliberate: replacing the article is a bigger act than filling an
 * empty editor, and the extra click is the price of the ADR-0005 rule.
 */
export function useRewrite(input: RewritePanelProps): RewriteState {
  const [fields, dispatch] = useReducer(reduce, INITIAL)
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields

  const stream = useStreamProposal({
    editable: input.editable,
    currentBody: input.body,
    onUseBody: input.onUseBody,
  })

  return {
    ...fields,
    ...stream,
    canRun: canRun(input.editable, input.body, stream.streaming, fields),
    setMode: (mode) => {
      fieldsRef.current = { ...fieldsRef.current, mode }
      dispatch({ type: 'mode', mode })
    },
    setInstruction: (value) => {
      fieldsRef.current = { ...fieldsRef.current, instruction: value }
      dispatch({ type: 'instruction', value })
    },
    setTone: (tone) => {
      fieldsRef.current = { ...fieldsRef.current, tone }
      dispatch({ type: 'tone', tone })
    },
    run: () => {
      const call = taskFor(fieldsRef.current, input)
      if (call !== null) stream.start(call)
    },
  }
}

function canRun(editable: boolean, body: string, streaming: boolean, fields: Fields): boolean {
  if (!editable || streaming || body.trim() === '') return false
  return fields.mode === 'rewrite' ? fields.instruction.trim() !== '' : true
}

function taskFor(fields: Fields, input: RewritePanelProps): TaskCall | null {
  if (!canRun(input.editable, input.body, false, fields)) return null

  const ctx = { title: input.title, body: input.body, locale: input.locale }
  return fields.mode === 'rewrite'
    ? { task: 'rewrite', body: { ...ctx, instruction: fields.instruction.trim() } }
    : { task: 'tone', body: { ...ctx, tone: fields.tone } }
}
