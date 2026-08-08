import { z } from 'zod'

/**
 * Schemas for structured output. The SDK validates against these, so a model
 * that returns something malformed fails loudly here rather than surfacing as
 * `undefined` three layers up in the CMS.
 */

export const headlinesSchema = z.object({
  headlines: z
    .array(
      z.object({
        text: z.string().min(1).max(120),
        rationale: z.string().min(1),
      }),
    )
    .min(1)
    .max(8),
})

export const seoSchema = z.object({
  metaTitle: z.string().min(1).max(60),
  // Google truncates around 155 characters; longer is wasted work.
  metaDescription: z.string().min(1).max(160),
  keywords: z.array(z.string().min(1)).min(1).max(12),
})

export const tagsSchema = z.object({
  tags: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(10),
})

export const categorySchema = z.object({
  categories: z
    .array(
      z.object({
        slug: z.string().min(1),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(3),
})

export const summarySchema = z.object({
  short: z.string().min(1).max(400),
  bullets: z.array(z.string().min(1)).min(1).max(6),
})

export const translationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
})

export const factCheckSchema = z.object({
  notes: z
    .array(
      z.object({
        claim: z.string().min(1),
        concern: z.string().min(1),
        suggestedSource: z.string().min(1),
      }),
    )
    .max(20),
})

export const imagePromptSchema = z.object({
  prompt: z.string().min(1).max(600),
})
