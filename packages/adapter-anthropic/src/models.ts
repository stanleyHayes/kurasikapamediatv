import { anthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

/**
 * Not every editorial task needs the same model. Auto-tagging a wire story and
 * rewriting a lead are different jobs with different price tags, and routing
 * them identically is how AI features quietly become the biggest line item.
 */
export type AiTask =
  | 'draft'
  | 'rewrite'
  | 'headline'
  | 'seo'
  | 'classify'
  | 'summarise'
  | 'translate'
  | 'factcheck'
  | 'image'

export interface ModelResolver {
  for(task: AiTask): LanguageModel
}

/**
 * Verified against @ai-sdk/anthropic's own model union, not from memory.
 *
 * NOTE ON NAMING — these are **direct provider** ids, which hyphenate the
 * version (`claude-haiku-4-5`). The AI Gateway uses a different namespace and
 * dots (`anthropic/claude-haiku-4.5`). We are on the direct provider per
 * ADR-0005, so hyphens are correct here. Linters tuned for Gateway slugs flag
 * this as an error; it is a false positive, and `tsc` proves it — the ids are
 * checked against the provider's own union type.
 */
export const MODELS = {
  best: 'claude-opus-5',
  balanced: 'claude-sonnet-5',
  cheap: 'claude-haiku-4-5',
} as const

const ROUTING: Readonly<Record<AiTask, keyof typeof MODELS>> = {
  // Editors read every word of these, and a weak rewrite wastes their time.
  draft: 'balanced',
  rewrite: 'balanced',
  headline: 'balanced',
  // Fact-checking is the one place a miss is a correction, not an annoyance.
  factcheck: 'best',
  // Translation carries the brand into another language; worth the tokens.
  translate: 'balanced',
  // Mechanical. A cheap model is indistinguishable here.
  seo: 'cheap',
  classify: 'cheap',
  summarise: 'cheap',
  image: 'cheap',
}

/**
 * The production resolver. Overrides exist so a task can be re-pointed from
 * config without a deploy — useful when a cheap model turns out to be enough,
 * or isn't.
 */
export function anthropicModels(overrides: Partial<Record<AiTask, string>> = {}): ModelResolver {
  return {
    for(task: AiTask): LanguageModel {
      const override = overrides[task]
      return anthropic(override ?? MODELS[ROUTING[task]])
    },
  }
}

/** Routes every task to one model. For tests, and for single-model deployments. */
export const singleModel = (model: LanguageModel): ModelResolver => ({ for: () => model })
