import { CADENCES, MAX_COMMENT_BODY } from '@kurasikapa/domain'
import { z } from 'zod'

/**
 * Server Action inputs arrive from a browser and are not trustworthy, even
 * from a signed-in editor. Every action parses before it reaches a use case.
 */

const id = z.string().trim().min(1).max(100)

export const createDraftSchema = z.object({
  locale: z.string().trim().min(2).max(10),
  title: z.string().trim().min(1).max(300),
  body: z.string().max(200_000),
  categoryId: id,
  tagIds: z.array(id).max(20).optional(),
  familyId: id.optional(),
})

export const articleRefSchema = z.object({ articleId: id })

export const subscribePushSchema = z.object({
  endpoint: z.url(),
  p256dh: z.string().trim().min(1).max(500),
  auth: z.string().trim().min(1).max(200),
  locale: z.string().trim().min(2).max(10),
})

export const unsubscribePushSchema = z.object({
  endpoint: z.url(),
})

export const updateDraftSchema = z.object({
  articleId: id,
  title: z.string().trim().min(1).max(300),
  body: z.string().max(200_000),
})

export const bookmarkSchema = z.object({ articleId: id })

export const approveSchema = z.object({ articleId: id, revisionId: id })

export const rejectSchema = z.object({
  articleId: id,
  // An editor rejecting without saying why sends the author back to guess.
  note: z.string().trim().min(1, 'A rejection needs a note for the author').max(2000),
})

export const scheduleSchema = z.object({
  articleId: id,
  // Serialised over the wire; the domain compares it against an injected clock.
  at: z.coerce.date(),
})

export const unpublishSchema = z.object({
  articleId: id,
  reason: z.string().trim().min(1, 'Pulling an article needs a reason for the audit log').max(2000),
})

export const assignRolesSchema = z.object({
  targetUserId: id,
  // Left as strings on purpose — the domain decides what is a role.
  roles: z.array(z.string().trim().min(1)).max(11),
})

export const aiContextSchema = z.object({
  title: z.string().trim().min(1).max(300),
  body: z.string().min(1).max(200_000),
  locale: z.string().trim().min(2).max(10),
})

export const rewriteSchema = aiContextSchema.extend({
  instruction: z.string().trim().min(1).max(1000),
})

/**
 * Streaming draft generation — prompt or bullets, never both on one schema.
 *
 * The port keeps these as separate methods (different prompts, same model),
 * so the wire shapes stay separate too. Collapsing them into one "mode"
 * enum would let a client send bullets to the prompt path and spend tokens
 * on nonsense.
 */
export const draftPromptSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  locale: z.string().trim().min(2).max(10),
})

export const draftBulletsSchema = z.object({
  bullets: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  locale: z.string().trim().min(2).max(10),
})

/** The five tones the AiPort accepts — inventing one is a 400, not a model call. */
export const toneSchema = aiContextSchema.extend({
  tone: z.enum(['neutral', 'formal', 'conversational', 'urgent', 'analytical']),
})

export class InvalidInput extends Error {
  constructor(readonly issues: readonly string[]) {
    super(issues.join('; '))
    this.name = 'InvalidInput'
  }
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (result.success) return result.data

  throw new InvalidInput(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`))
}

/**
 * Queueing a social post.
 *
 * Platforms is a non-empty array of known values — an empty selection is a
 * request to do nothing, and accepting it would create a "queued" state the
 * fan-out worker can never resolve. `scheduledAt` is validated as a datetime
 * string here and turned into a Date at the boundary; the domain refuses a
 * past time, so this only has to guarantee the shape.
 */
export const queueSocialPostSchema = z.object({
  articleId: z.string().min(1),
  platforms: z.array(z.enum(['facebook', 'instagram'])).min(1),
  caption: z.string().trim().min(1).max(2200),
  scheduledAt: z.iso.datetime(),
})

/**
 * Requesting a translation proposal.
 *
 * `targetLocale` is a literal union, not a free string: an arbitrary locale
 * would produce an article at a URL prefix the router does not serve, and the
 * cost of that only shows up after the model has been paid.
 */
export const translateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  body: z.string().min(1).max(200_000),
  locale: z.string().trim().min(2).max(10),
  targetLocale: z.enum(['en', 'fr']),
})

/** Restoring an older revision as the current text. */
export const restoreRevisionSchema = z.object({
  articleId: id,
  revisionId: id,
})

export const postCommentSchema = z.object({
  articleId: id,
  body: z.string().trim().min(1).max(MAX_COMMENT_BODY),
})

export const moderateCommentSchema = z.object({
  commentId: id,
  decision: z.enum(['approve', 'reject']),
})

export const subscribeNewsletterSchema = z.object({
  email: z.string().trim().min(3).max(254),
  locales: z.array(z.enum(['en', 'fr'])).min(1).max(2),
  cadence: z.enum(CADENCES),
})

export const unsubscribeNewsletterSchema = z.object({
  email: z.string().trim().min(3).max(254),
})
