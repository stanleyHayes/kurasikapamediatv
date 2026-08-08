import { cacheLife } from 'next/cache'

/**
 * The copyright year is *data*, not markup.
 *
 * Under Cache Components, reading the clock in a Server Component before any
 * uncached data is a prerender error — and rightly so: a prerendered page has
 * no "now". Marking this `use cache` with a daily lifetime gives the year a
 * defined freshness instead of freezing it at build time.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- `use cache` requires an async function; there is nothing to await.
export async function SiteFooter(): Promise<React.ReactElement> {
  'use cache'
  cacheLife('days')

  const year = new Date().getUTCFullYear()

  return (
    <footer className="border-outline-variant mt-[var(--spacing-xl)] border-t">
      <div className="text-on-surface-variant mx-auto max-w-[var(--container-page)] px-6 py-8 text-sm">
        © {year} Kurasikapa Media TV
      </div>
    </footer>
  )
}
