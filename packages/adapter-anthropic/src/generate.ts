import { type LanguageModel, Output, generateText, streamText } from 'ai'
import type { z } from 'zod'

export interface Call {
  readonly model: LanguageModel
  readonly system: string
  readonly prompt: string
}

export interface StructuredCall<T> extends Call {
  readonly schema: z.ZodType<T>
}

/**
 * `textStream` is both a ReadableStream and an AsyncIterable, so returning it
 * satisfies the port without the application ever seeing an SDK type.
 */
export const streamOf = (call: Call): AsyncIterable<string> =>
  streamText({ model: call.model, system: call.system, prompt: call.prompt }).textStream

/**
 * Structured generation. The SDK validates against the schema, so a malformed
 * response throws here instead of arriving in the CMS as `undefined`.
 */
export async function objectOf<T>(call: StructuredCall<T>): Promise<T> {
  const { output } = await generateText({
    model: call.model,
    system: call.system,
    prompt: call.prompt,
    output: Output.object({ schema: call.schema }),
  })

  return output
}
