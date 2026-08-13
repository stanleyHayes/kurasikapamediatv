import { callAction } from '@kurasikapa/web-kit/actions/call'
import {
  detectCategoryAction,
  factCheckAction,
  grammarCheckAction,
  imagePromptAction,
  suggestHeadlinesAction,
  suggestSeoAction,
  suggestTagsAction,
  summariseAction,
} from '../actions/ai'
import type { ActionResult } from '@kurasikapa/web-kit/actions/result'
import type { Suggestion } from './suggestion-list'

export type Assist =
  | 'headlines'
  | 'seo'
  | 'tags'
  | 'summary'
  | 'factcheck'
  | 'grammar'
  | 'category'
  | 'imageprompt'

export const LABEL: Readonly<Record<Assist, string>> = {
  headlines: 'Headlines',
  seo: 'SEO',
  tags: 'Tags',
  summary: 'Summary',
  factcheck: 'Fact check',
  grammar: 'Grammar',
  category: 'Category',
  imageprompt: 'Image prompt',
}

interface Ctx {
  title: string
  body: string
  locale: string
}

const ok = (items: readonly Suggestion[]): ActionResult<readonly Suggestion[]> => ({
  ok: true,
  data: items,
})

/**
 * Each assist maps its own result shape to one list the panel can render.
 * Keeping the mapping here rather than in the panel means adding an assist is
 * one entry, not a new branch in the view.
 *
 * Only headlines are `applicable` — they have a field to land in. The rest are
 * review material: the editor reads them and acts by hand, which keeps every
 * one of these a proposal rather than an edit (ADR-0005).
 */
export const ASSISTS: Readonly<
  Record<Assist, (ctx: Ctx) => Promise<ActionResult<readonly Suggestion[]>>>
> = {
  headlines: async (ctx) => {
    const result = await callAction(() => suggestHeadlinesAction(ctx))
    if (!result.ok) return result

    return ok(result.data.map((h) => ({ text: h.text, note: h.rationale, applicable: true })))
  },

  seo: async (ctx) => {
    const result = await callAction(() => suggestSeoAction(ctx))
    if (!result.ok) return result

    return ok([
      { text: result.data.metaTitle, note: 'Meta title', applicable: false },
      { text: result.data.metaDescription, note: 'Meta description', applicable: false },
      { text: result.data.keywords.join(', '), note: 'Keywords', applicable: false },
    ])
  },

  tags: async (ctx) => {
    const result = await callAction(() => suggestTagsAction(ctx))
    if (!result.ok) return result

    return ok(
      result.data.map((t) => ({
        text: t.label,
        note: `confidence ${t.confidence.toFixed(2)}`,
        applicable: false,
      })),
    )
  },

  summary: async (ctx) => {
    const result = await callAction(() => summariseAction(ctx))
    if (!result.ok) return result

    return ok([
      { text: result.data.short, note: 'Summary', applicable: false },
      ...result.data.bullets.map((b) => ({ text: b, note: 'Bullet', applicable: false })),
    ])
  },

  factcheck: async (ctx) => {
    const result = await callAction(() => factCheckAction(ctx))
    if (!result.ok) return result

    return ok(
      result.data.map((n) => ({
        text: n.claim,
        note: `${n.concern} — check against: ${n.suggestedSource}`,
        applicable: false,
      })),
    )
  },

  grammar: async (ctx) => {
    const result = await callAction(() => grammarCheckAction(ctx))
    if (!result.ok) return result

    return ok(
      result.data.map((issue) => ({
        text: issue.excerpt,
        note: `${issue.problem} → ${issue.suggestion}`,
        applicable: false,
      })),
    )
  },

  category: async (ctx) => {
    const result = await callAction(() => detectCategoryAction(ctx))
    if (!result.ok) return result

    return ok(
      result.data.map((c) => ({
        text: c.slug,
        note: `confidence ${c.confidence.toFixed(2)}`,
        applicable: false,
      })),
    )
  },

  imageprompt: async (ctx) => {
    const result = await callAction(() => imagePromptAction(ctx))
    if (!result.ok) return result

    return ok([{ text: result.data, note: 'Prompt for the image generator', applicable: false }])
  },
}
