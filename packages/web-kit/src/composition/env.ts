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

  /**
   * Origins of the two deployables, for the links that cross between them.
   *
   * Both optional because the default deployment shape — the studio mounted at
   * `/studio` on the public domain via a rewrite — needs neither: the studio
   * and the site share an origin, so `APP_URL` answers both questions. Set
   * them only when the two are deployed to different hosts. See
   * `origins.ts` for the fallbacks and ADR-0011 for the deployment modes.
   */
  SITE_URL: z.url().optional(),
  STUDIO_URL: z.url().optional(),

  /**
   * Parent domain for the session cookie, e.g. `.kurasikapa.tv`.
   *
   * Required ONLY for split-origin deployment. The site issues the session and
   * the studio reads it; a host-scoped cookie set on `kurasikapa.tv` is never
   * sent to `studio.kurasikapa.tv`, so without this an editor signs in
   * successfully and the studio still bounces them back to sign in — a loop.
   *
   * Unset in the same-origin shape, where a host cookie already reaches both.
   */
  COOKIE_DOMAIN: z.string().min(1).optional(),

  /**
   * Shared secret for the site's `/api/revalidate` endpoint.
   *
   * Next's cache tags are per-deployment, so a publish in the studio cannot
   * refresh the public site's cache directly — it posts the tags instead, and
   * this authorises that call. Set it on BOTH deployments, to the same value.
   *
   * Optional so local development and tests boot without it — but the endpoint
   * REFUSES every request when it is unset, and the studio raises a reported
   * failure rather than publishing into a site that will not update.
   */
  REVALIDATE_SECRET: z.string().min(32).optional(),

  /**
   * Shared secret for the scheduled-publication endpoint.
   *
   * Optional so local development and tests boot without it — but the route
   * REFUSES every request when it is unset, rather than running unprotected.
   * An endpoint that publishes articles must never be open, and "unconfigured"
   * is not a reason to make it so.
   */
  CRON_SECRET: z.string().min(32).optional(),

  /**
   * Base URL for the Go API (ADR-0009 BFF seam).
   *
   * Optional so unit tests and a Next-only local boot still work. When set,
   * editorial reads and writes call this service instead of the in-process
   * TypeScript use cases. Public routes need no user header; CMS routes trust
   * `X-Kurasikapa-User`. The service must not be publicly routable.
   */
  API_URL: z.url().optional(),

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
