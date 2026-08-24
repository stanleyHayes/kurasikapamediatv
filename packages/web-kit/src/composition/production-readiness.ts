import type { Env } from './env'
import { siteUrl, studioUrl } from './origins'

/**
 * The gap between "the process starts" and "the platform actually works".
 *
 * `env.ts` validates what the process needs to BOOT — a missing MONGODB_URI is
 * a crash, so it belongs in the schema. This file covers the other failure
 * mode, the one that has no symptom: keys whose absence the code handles
 * correctly and silently.
 *
 * CRON_SECRET is the clearest case. The cron routes 404 when it is unset,
 * which is right — an endpoint that publishes articles must never be open, and
 * "unconfigured" is not a reason to make it so. But the consequence is a
 * newsroom whose scheduled publication, RSS ingest and two digests all do
 * nothing, on a site that looks healthy. Nobody finds that from a dashboard;
 * they find it from a reader asking where Monday's piece went.
 *
 * So these checks run once, at server start, and refuse to come up rather than
 * serve a plausible-looking half-platform.
 */
export interface ReadinessGap {
  /** The environment key to set. */
  key: string
  /** What breaks while it is unset — the reason, not a restatement of the key. */
  why: string
}

/**
 * Next sets this while prerendering. `next build` runs with
 * NODE_ENV=production and none of the deployment secrets, by design: the build
 * never serves a request. Treating it as a production BOOT would turn a
 * deployment-config gap into a red build — the same problem reported in the
 * wrong place, to the wrong person.
 */
const BUILD_PHASE = 'phase-production-build'

/** Addresses that reach nobody, whatever the port. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

const isLoopback = (url: string): boolean => {
  try {
    return LOOPBACK.has(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * Hostname, NOT `host`. Cookies are scoped by host and ignore the port, so
 * `localhost:3000` and `localhost:3001` share a cookie jar — which is exactly
 * why `pnpm dev` signs you into both apps with no COOKIE_DOMAIN set. Comparing
 * `host` here would demand one for every local run and teach people that this
 * check cries wolf.
 */
const hostnameOf = (url: string): string | undefined => {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

/**
 * Secrets whose absence the code handles correctly and invisibly.
 *
 * A table rather than a run of `if`s: each entry is one deployment key and the
 * single consequence of leaving it unset, which is the whole content of the
 * check.
 */
const SILENT_SECRETS: readonly {
  readonly key: 'CRON_SECRET' | 'REVALIDATE_SECRET'
  readonly why: string
}[] = [
  {
    key: 'CRON_SECRET',
    why: 'every schedule is inert — scheduled publication, RSS ingest and both digests 404 and report nothing',
  },
  {
    key: 'REVALIDATE_SECRET',
    why: 'publishing cannot refresh the public site, so breaking news stays invisible until the cache expires on its own',
  },
]

/**
 * The sign-in loop from ADR-0011 § 4, caught before it ships.
 *
 * Split-origin only. In the same-origin shape a host cookie already reaches
 * both deployables, and widening it is the stricter setting given away for
 * nothing — so this asks for COOKIE_DOMAIN when, and only when, the site and
 * the studio sit on different hostnames.
 */
function cookieDomainGap(env: Env): ReadinessGap | null {
  if (env.COOKIE_DOMAIN !== undefined) return null

  const site = hostnameOf(siteUrl(env))
  const studio = hostnameOf(studioUrl(env))

  if (site === undefined || studio === undefined || site === studio) return null

  return {
    key: 'COOKIE_DOMAIN',
    why: `the session cookie issued on ${site} is never sent to ${studio}, so an editor signs in and the studio bounces them straight back`,
  }
}

export interface ReadinessContext {
  /** Next's build phase, so prerendering never trips a deployment check. */
  readonly phase?: string | undefined
  /**
   * The RAW `APP_URL`, before the schema applied its localhost default.
   *
   * The difference between unset and explicitly-loopback is the whole check.
   * Unset means nobody configured this deployment. Explicitly loopback means
   * somebody meant it — the Playwright suite serves production builds on
   * 127.0.0.1 precisely because Cache Components and Server Actions behave
   * differently under `next dev`, and that server is not reachable by a
   * reader, has no schedules worth firing and no cache anyone is waiting on.
   */
  readonly rawAppUrl?: string | undefined
}

/**
 * Nobody set APP_URL: the schema's localhost default is showing, and every
 * absolute URL this deployment emits would point at whoever built it.
 */
const APP_URL_UNSET: ReadinessGap = {
  key: 'APP_URL',
  why: 'unset, so canonicals, OpenGraph tags, e-mail links and every cross-deployment redirect fall back to localhost',
}

/**
 * Every deployment gap in one pass.
 *
 * Returns all of them rather than throwing on the first, so a single deploy
 * closes the set. Finding these one redeploy at a time is how a ten-minute fix
 * becomes an afternoon.
 */
export function productionGaps(env: Env, context: ReadinessContext = {}): ReadinessGap[] {
  const { phase = process.env['NEXT_PHASE'], rawAppUrl = process.env['APP_URL'] } = context

  if (env.NODE_ENV !== 'production' || phase === BUILD_PHASE) return []
  if (rawAppUrl === undefined || rawAppUrl.trim() === '') return [APP_URL_UNSET]

  // Set, on purpose, to an address no reader can reach — a server under test.
  // Checking a test harness for deployment secrets teaches people that this
  // check is noise, and a check people route around protects nothing.
  if (isLoopback(rawAppUrl)) return []

  const gaps: ReadinessGap[] = SILENT_SECRETS.filter(({ key }) => env[key] === undefined).map(
    ({ key, why }) => ({ key, why }),
  )

  const cookies = cookieDomainGap(env)

  return cookies === null ? gaps : [...gaps, cookies]
}

/**
 * Fail at start, naming everything that is missing and what each one costs.
 *
 * Called from each app's `instrumentation.ts`, which Next runs once when the
 * server comes up — not during the build, and not per request.
 */
export function assertProductionReady(env: Env, context: ReadinessContext = {}): void {
  const gaps = productionGaps(env, context)
  if (gaps.length === 0) return

  const lines = gaps.map(({ key, why }) => `  ${key} — ${why}`).join('\n')

  throw new Error(
    `Incomplete production environment. The process would start and quietly not work:\n${lines}\n\nSet these on the deployment. See .env.example.`,
  )
}
