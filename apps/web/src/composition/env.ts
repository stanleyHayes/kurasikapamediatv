import { z } from 'zod'

/**
 * Environment, validated once at the edge of the process.
 *
 * A missing MONGODB_URI should fail at boot with a readable message, not as a
 * connection error inside a reader's first request.
 */
const schema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1).default('kurasikapa'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  DEFAULT_LOCALE: z.string().min(2).default('en'),

  // Auth. The secret signs session cookies, so a weak one is a full compromise
  // of every account — 32 characters is the floor, not a suggestion.
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_URL: z.url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof schema>

let cached: Env | undefined

export function env(): Env {
  cached ??= parse(process.env)
  return cached
}

/**
 * Takes a plain record rather than `NodeJS.ProcessEnv`, whose declared shape
 * requires NODE_ENV and so cannot be constructed in a test. What we actually
 * need is "string keys, possibly-undefined string values".
 */
export function parse(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source)

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid environment: ${missing}. See .env.example.`)
  }

  return result.data
}

/** Test seam — lets a suite reset the memoised value. */
export function resetEnv(): void {
  cached = undefined
}
