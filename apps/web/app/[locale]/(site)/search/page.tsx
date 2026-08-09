import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { Link } from '@/i18n/navigation'
import { currentActor } from '@/composition/actor'
import { container } from '@/composition/container'
import { callerKey, limit } from '@/security/rate-limit'

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}

/**
 * `searchParams` is request data, so the results stream inside a boundary and
 * the form ships with the prerendered shell — a reader can start typing the
 * next query while the previous one is still resolving.
 */
export default async function SearchPage(props: Props): Promise<React.ReactElement> {
  const { locale } = await props.params
  setRequestLocale(locale)

  return (
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-lg)]">
      <form action={`/${locale}/search`} role="search" className="mb-[var(--spacing-lg)]">
        <label className="flex flex-col gap-2">
          <span className="text-label-bold text-on-surface-variant uppercase">Search</span>
          <input
            name="q"
            type="search"
            className="border-outline-variant focus:border-secondary bg-surface-container-lowest text-on-surface max-w-xl rounded border px-3 py-2 outline-none transition-colors"
          />
        </label>
      </form>

      <Suspense fallback={<p className="text-on-surface-variant">Searching…</p>}>
        <Results searchParams={props.searchParams} locale={locale} />
      </Suspense>
    </section>
  )
}

async function Results({
  searchParams,
  locale,
}: {
  searchParams: Props['searchParams']
  locale: string
}): Promise<React.ReactElement> {
  const { q } = await searchParams
  const terms = (q ?? '').trim()

  // Checked before the query, not after. The use case short-circuits on a
  // short term anyway, so this is not a correctness fix — but calling it and
  // then deciding the call was pointless reads as if the guard were doing
  // something it is not.
  if (terms.length < 2) {
    return <p className="text-on-surface-variant">Type at least two characters.</p>
  }

  // Limited only once there is a real query. A `$text` scan is the cost worth
  // protecting; an empty search box is not, and limiting it would let a reader
  // exhaust their allowance by pressing enter on nothing.
  //
  // Fails OPEN: search is the least valuable thing to protect and the most
  // visible to break, and a reader who cannot search because a counter is
  // unreachable has no idea why.
  const actor = await currentActor()
  const verdict = await limit(
    container().rateLimiter,
    await callerKey(actor?.id ?? null),
    'search',
    'open',
  )

  if (!verdict.allowed) {
    return (
      <p className="text-on-surface-variant">
        Too many searches. Try again in {verdict.retryAfterSeconds} seconds.
      </p>
    )
  }

  const page = await container().searchArticles.execute({ terms, locale })

  if (page.items.length === 0) {
    return <p className="text-on-surface-variant">Nothing matched “{terms}”.</p>
  }

  return (
    <ul>
      {page.items.map((hit) => (
        <li key={hit.articleId} className="border-outline-variant border-b py-4">
          <Link href={`/articles/${hit.slug}`} className="text-on-surface hover:text-primary">
            {hit.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}
