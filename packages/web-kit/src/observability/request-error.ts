import type { Instrumentation } from 'next'
import { describeError } from './report-error'

/**
 * The single seam every server-side request error passes through.
 *
 * Next calls `onRequestError` for anything thrown while rendering a page,
 * running a route handler or executing a Server Action — the errors that
 * otherwise become a 500 the newsroom hears about from a reader. Without this
 * they reach stderr as a React stack with no route attached, which is not
 * enough to find the page that broke.
 *
 * Deliberately not a provider SDK. Choosing and provisioning one is an
 * operations decision, and a platform that logs a structured line to stderr
 * already works with Vercel's log drains, Render's, and every aggregator
 * either can forward to. When a DSN does arrive it replaces the `sink`
 * argument here and nothing else changes.
 */

/**
 * Never widened to include `headers`.
 *
 * Next hands them to us, and they carry the session cookie and the
 * Authorization header. Copying those into an error report turns a crash into
 * a credential leak in whatever aggregates the logs — and log retention
 * outlives the session they would expose.
 */
interface RequestErrorLine {
  event: 'request.error'
  path: string
  method: string
  routerKind: string
  routePath: string
  routeType: string
  renderSource?: string
  revalidateReason?: string
  error: string
  stack?: string
}

/** Query strings carry reset tokens, magic-link tokens and search terms. */
const pathOnly = (path: string): string => path.split('?')[0] ?? path

export function reportRequestError(
  error: unknown,
  request: Parameters<Instrumentation.onRequestError>[1],
  context: Parameters<Instrumentation.onRequestError>[2],
  sink: (line: string) => void = console.error,
): void {
  const line: RequestErrorLine = {
    event: 'request.error',
    path: pathOnly(request.path),
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    ...(context.renderSource !== undefined && { renderSource: context.renderSource }),
    ...(context.revalidateReason !== undefined && { revalidateReason: context.revalidateReason }),
    error: describeError(error),
    ...(error instanceof Error && error.stack !== undefined && { stack: error.stack }),
  }

  sink(JSON.stringify(line))
}
