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
