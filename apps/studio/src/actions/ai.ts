'use server'

import type {
  CategorySuggestion,
  FactCheckNote,
  GrammarIssue,
  Headline,
  SeoSuggestion,
  Summary,
  TagSuggestion,
  TranslatedArticle,
} from '@kurasikapa/application'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { RateLimited, callerKey, limit } from '@kurasikapa/web-kit/security/rate-limit'
import { type ActionResult, attempt } from '@kurasikapa/web-kit/actions/result'
import { aiContextSchema, parseInput, translateSchema } from '@kurasikapa/web-kit/actions/schemas'

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
    await requireAiBudget()

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

export async function grammarCheckAction(
  input: unknown,
): Promise<ActionResult<readonly GrammarIssue[]>> {
  return assist(input, (ctx) => container().ai.grammarCheck(ctx))
}

export async function imagePromptAction(input: unknown): Promise<ActionResult<string>> {
  return assist(input, (ctx) => container().ai.imagePrompt(ctx))
}

/**
 * Suggests the section an article belongs to.
 *
 * The options come from listSections HERE, on the server, never from the
 * client: the model may only pick a category that exists, and a
 * browser-supplied list is exactly how an invented one would slip in.
 */
export async function detectCategoryAction(
  input: unknown,
): Promise<ActionResult<readonly CategorySuggestion[]>> {
  return assist(input, async (ctx) => {
    const sections = await container().listSections.execute({ locale: ctx.locale })
    const options = sections
      .filter((section) => section.coversLocale(ctx.locale))
      .map((section) => ({
        slug: section.slugIn(ctx.locale).toString(),
        label: section.nameIn(ctx.locale),
      }))

    return container().ai.detectCategory({ ...ctx, options })
  })
}

/**
 * Proposes a translation. Persists nothing.
 *
 * Product rule 1: no AI output is persisted or published without a named human
 * approver. So this returns a proposal and stops. Turning it into an article
 * is a separate, deliberate act — the editor reads the translation and calls
 * createDraft, which is the same path any other draft takes.
 *
 * "Locale is data" is what makes that work: the French article is its own
 * document with its own slug and publish state, joined to the English one by
 * familyId. There is no field to overwrite and nothing to get half-written.
 */
export async function translateAction(input: unknown): Promise<ActionResult<TranslatedArticle>> {
  return attempt(async () => {
    const parsed = parseInput(translateSchema, input)
    await requireAiBudget()

    return container().ai.translate({
      title: parsed.title,
      body: parsed.body,
      locale: parsed.locale,
      targetLocale: parsed.targetLocale,
    })
  })
}

/**
 * Authenticates AND counts the call against the AI budget.
 *
 * Every AI action shares one limit rather than each having its own, because
 * they share one bill. Per-action limits would let a caller take the sum of
 * them, which is the number nobody meant to allow.
 *
 * Fails CLOSED, like the streaming route: an uncounted AI call is an
 * unbounded one.
 */
async function requireAiBudget(): Promise<void> {
  const actor = await requireActor()

  const verdict = await limit(container().rateLimiter, await callerKey(actor.id), 'ai', 'closed')
  if (!verdict.allowed) {
    throw new RateLimited(verdict.retryAfterSeconds)
  }
}
