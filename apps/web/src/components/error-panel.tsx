'use client'

/**
 * Shared recovery UI for route and global error boundaries.
 *
 * The digest is the only identifier safe to show — the message may contain a
 * Mongo URI or a session token, and this page is public.
 */
export function ErrorPanel({
  digest,
  onRetry,
}: {
  digest: string | undefined
  onRetry: () => void
}): React.ReactElement {
  return (
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-xl)]">
      <h1 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
        Something went wrong
      </h1>
      <p className="text-on-surface-variant mt-4 max-w-prose text-[length:var(--text-body-lg)]">
        The page could not be rendered. Retrying often works; if it does not,
        the newsroom can look up the reference below.
      </p>
      {digest !== undefined && digest !== '' && (
        <p className="text-on-surface-variant mt-4 font-mono text-sm">Reference {digest}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="bg-primary text-on-primary text-label-bold mt-8 rounded px-4 py-2 uppercase"
      >
        Try again
      </button>
    </section>
  )
}
