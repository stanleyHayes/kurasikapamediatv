import { type LanguageModel, simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

/**
 * The SDK's own mock provider, so the suite runs offline and free while still
 * exercising the real generateText / streamText / Output.object code paths.
 */

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
} as const

const STOP = { unified: 'stop', raw: undefined } as const

export interface Captured {
  system?: string | undefined
  prompt?: unknown
}

/** Returns a model that replies with `json`, and a record of what it was sent. */
export function mockObjectModel(json: unknown): { model: LanguageModel; captured: Captured } {
  const captured: Captured = {}

  const model = new MockLanguageModelV4({
    doGenerate: (options) => {
      captured.prompt = options.prompt
      return Promise.resolve({
        content: [{ type: 'text' as const, text: JSON.stringify(json) }],
        finishReason: STOP,
        usage: USAGE,
        warnings: [],
      })
    },
  })

  return { model, captured }
}

/** Returns a model that streams `parts` as text deltas. */
export function mockStreamModel(parts: readonly string[]): {
  model: LanguageModel
  captured: Captured
} {
  const captured: Captured = {}

  const model = new MockLanguageModelV4({
    doStream: (options) => {
      captured.prompt = options.prompt
      return Promise.resolve({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-start' as const, id: 't1' },
            ...parts.map((delta) => ({ type: 'text-delta' as const, id: 't1', delta })),
            { type: 'text-end' as const, id: 't1' },
            { type: 'finish' as const, finishReason: STOP, logprobs: undefined, usage: USAGE },
          ],
        }),
      })
    },
  })

  return { model, captured }
}

/** Drains an AsyncIterable<string> into the full text. */
export async function drain(stream: AsyncIterable<string>): Promise<string> {
  let text = ''
  for await (const part of stream) text += part
  return text
}

/** Flattens the SDK prompt structure into searchable text. */
export const promptText = (captured: Captured): string => JSON.stringify(captured.prompt ?? '')
