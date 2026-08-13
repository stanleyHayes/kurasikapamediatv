'use client'

/**
 * Recovery UI for the studio's error boundaries.
 *
 * Written for the admin canvas rather than shared with the public site's
 * ErrorPanel: this renders inside a 256px-rail shell, addresses a colleague
 * rather than a reader, and says what an editor actually needs to know — that
 * their draft is safe, because every revision was already written server-side.
 * A reader has no draft to reassure them about.
 *
 * The digest is the only identifier safe to show. The message may contain a
 * Mongo URI or a session token.
 */
export function ErrorRecovery({
  digest,
  onRetry,
}: {
  digest: string | undefined
  onRetry: () => void
}): React.ReactElement {
  return (
    <section className="border-outline-variant bg-surface-container-low mx-auto mt-12 max-w-2xl rounded-xl border p-8">
      <h1 className="font-display text-on-surface text-[length:var(--text-headline-sm)] font-semibold">
        This screen failed to load
      </h1>
      <p className="text-on-surface-variant mt-4 text-[length:var(--text-body-lg)]">
        Nothing you wrote has been lost — revisions are saved server-side as you
        type. Retrying usually works.
      </p>
      {digest !== undefined && digest !== '' && (
        <p className="text-on-surface-variant mt-4 font-mono text-sm">
          Reference {digest} — quote this to whoever is on call.
        </p>
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
