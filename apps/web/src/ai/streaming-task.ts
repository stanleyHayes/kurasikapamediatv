import type { AiPort } from '@kurasikapa/application'
import {
  draftBulletsSchema,
  draftPromptSchema,
  parseInput,
  rewriteSchema,
  toneSchema,
} from '../actions/schemas'

const STREAMING_TASKS = ['draft', 'bullets', 'rewrite', 'tone'] as const

export type StreamingTask = (typeof STREAMING_TASKS)[number]

export const isStreamingTask = (value: string): value is StreamingTask =>
  (STREAMING_TASKS as readonly string[]).includes(value)

/**
 * Resolve a streaming AI task to the right port method.
 *
 * Lives outside the route handler so the dispatch can be tested without
 * standing up auth, rate limits, or a Next request. The route stays thin:
 * authenticate, budget, then hand the body to this.
 *
 * Getting the task wrong used to always call `rewrite` — every "draft" request
 * spent rewrite tokens on a body the rewrite schema then rejected or, worse,
 * accepted with nonsense fields. The mapping is the whole point of this file.
 */
export function streamForTask(
  ai: AiPort,
  task: StreamingTask,
  body: unknown,
): AsyncIterable<string> {
  switch (task) {
    case 'draft':
      return ai.draftFromPrompt(parseInput(draftPromptSchema, body))
    case 'bullets':
      return ai.draftFromBullets(parseInput(draftBulletsSchema, body))
    case 'rewrite':
      return ai.rewrite(parseInput(rewriteSchema, body))
    case 'tone':
      return ai.adjustTone(parseInput(toneSchema, body))
  }
}
