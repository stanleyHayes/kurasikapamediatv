/**
 * Error reporting, fail-closed.
 *
 * A missing DSN must still record the failure somewhere an operator can see
 * (stderr). Shipping a silent swallow would be worse than no Sentry project:
 * the newsroom would believe the boundary handled it.
 */
export function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

export function reportError(
  error: unknown,
  sink: (line: string) => void = console.error,
): void {
  sink(describeError(error))
}
