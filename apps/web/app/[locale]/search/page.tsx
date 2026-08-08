import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { Link } from '@/i18n/navigation'
import { container } from '@/composition/container'

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
  const terms = q ?? ''

  const page = await container().searchArticles.execute({ terms, locale })

  if (terms.trim().length < 2) {
    return <p className="text-on-surface-variant">Type at least two characters.</p>
  }

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
