'use server'

import type {
  CategorySuggestion,
  FactCheckNote,
  Headline,
  SeoSuggestion,
  Summary,
  TagSuggestion,
} from '@kurasikapa/application'
import { requireActor } from '../composition/actor'
import { container } from '../composition/container'
import { type ActionResult, attempt } from './result'
import { aiContextSchema, parseInput } from './schemas'

/**
 * AI assists for the editor.
 *
 * Every one of these returns a PROPOSAL. Nothing here writes to an article —
 * to persist a suggestion the editor accepts it, which calls `updateDraftAction`
 * like any other edit. That separation is the ADR-0005 rule made structural
 * rather than merely intended.
 *
 * `requireActor` gates each call: AI tokens cost money, so an unauthenticated
 * caller must not be able to spend them.
 */

const assist = <T>(input: unknown, run: (ctx: AiContext) => Promise<T>): Promise<ActionResult<T>> =>
  attempt(async () => {
    const ctx = parseInput(aiContextSchema, input)
    await requireActor()

    return run(ctx)
  })

interface AiContext {
  readonly title: string
  readonly body: string
  readonly locale: string
}

export async function suggestHeadlinesAction(
  input: unknown,
): Promise<ActionResult<readonly Headline[]>> {
  return assist(input, (ctx) => container().ai.suggestHeadlines(ctx))
}

export async function suggestSeoAction(input: unknown): Promise<ActionResult<SeoSuggestion>> {
  return assist(input, (ctx) => container().ai.suggestSeo(ctx))
}

export async function suggestTagsAction(
  input: unknown,
): Promise<ActionResult<readonly TagSuggestion[]>> {
  return assist(input, (ctx) => container().ai.suggestTags(ctx))
}

export async function summariseAction(input: unknown): Promise<ActionResult<Summary>> {
  return assist(input, (ctx) => container().ai.summarise(ctx))
}

export async function factCheckAction(
  input: unknown,
): Promise<ActionResult<readonly FactCheckNote[]>> {
  return assist(input, (ctx) => container().ai.factCheck(ctx))
}

export async function imagePromptAction(input: unknown): Promise<ActionResult<string>> {
  return assist(input, (ctx) => container().ai.imagePrompt(ctx))
}

export async function detectCategoryAction(
  input: unknown,
  options: readonly { slug: string; label: string }[],
): Promise<ActionResult<readonly CategorySuggestion[]>> {
  return assist(input, (ctx) => container().ai.detectCategory({ ...ctx, options }))
}
