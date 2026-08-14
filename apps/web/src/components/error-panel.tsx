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
    <section className="mx-auto max-w-[var(--container-page)] px-4 py-8 md:px-8">
      <div className="signal-grid bg-error-container border-l-[0.75rem] border-error px-7 py-16 md:px-14 md:py-24">
      <p className="eyebrow text-error mb-5">Transmission interrupted</p>
      <h1 className="font-display text-on-error-container text-[length:var(--text-headline-md)] font-semibold">
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
        className="bg-error text-on-error mt-8 rounded-full px-6 py-3 font-bold"
      >
        Try again
      </button>
      </div>
    </section>
  )
}
