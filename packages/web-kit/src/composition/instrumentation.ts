import type { Instrumentation } from 'next'
import { reportRequestError } from '../observability/request-error'
import { env } from './env'
import { assertProductionReady } from './production-readiness'

/**
 * What both deployments do when their server comes up.
 *
 * Next requires an `instrumentation.ts` per app, so each one still has its own
 * file — but the file is a re-export, not a copy. This is boot wiring that
 * must behave identically on the site and in the studio: if the two ever
 * diverge, one deployment is checking something the other is not, and the
 * check people rely on is the one that silently is not running. That is
 * different from a shared UI component, which ADR-0011 says to duplicate
 * rather than re-couple.
 */

/**
 * Runs once at server start — not per request, and not during `next build`,
 * which is why the production-environment assertion lives here rather than in
 * the schema `env.ts` validates at prerender.
 *
 * A deployment missing CRON_SECRET or REVALIDATE_SECRET starts perfectly well
 * and quietly does not publish. Refusing to come up is louder than a newsroom
 * discovering it a week later. It matters most on the studio, which owns the
 * three cron routes.
 */
export function registerApp(): void {
  assertProductionReady(env())
}

/**
 * Every server-side error Next catches — render, route handler, Server Action
 * — funnelled into one structured line. See `observability/request-error.ts`
 * for why this is stderr rather than a provider SDK, and for the headers it
 * must never carry.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  reportRequestError(error, request, context)
}
