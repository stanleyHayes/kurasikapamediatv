import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { currentActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { callerKey, limit } from '@kurasikapa/web-kit/security/rate-limit'

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
    <section className="mx-auto max-w-[var(--container-page)] px-4 py-[var(--space-xl)] md:px-8">
      <header className="mb-10 max-w-3xl"><p className="eyebrow text-primary-ink mb-4">Search the newsroom</p><h1 className="text-[length:var(--text-headline-md)]">Find the reporting you need.</h1></header>
      <form action={`/${locale}/search`} role="search" className="bg-inverse-surface mb-[var(--space-lg)] border-l-[0.75rem] border-secondary p-6 md:p-10">
        <label className="flex flex-col gap-2">
          <span className="eyebrow text-secondary-ink">Keywords</span>
          <input
            name="q"
            type="search"
            placeholder="Politics, business, a reporter…"
            className="bg-surface-container-lowest text-on-surface mt-2 w-full max-w-3xl rounded-2xl px-5 py-4 text-lg"
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
