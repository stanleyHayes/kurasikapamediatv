import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { ArticleCard } from '@/components/article-card'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { ArticleView } from '@kurasikapa/web-kit/read-model/article-view'
import { cachedLatest } from '@kurasikapa/web-kit/read-model/queries'

interface Params {
  params: Promise<{ locale: string }>
}

/**
 * One chronological listing is one deep read. Fifty covers a news day's
 * output several times over; cursor paging belongs to search, which has it.
 */
const PAGE_SIZE = 50

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'nav' })

  return {
    title: t('news'),
    alternates: { canonical: `/${locale}/news` },
  }
}

/**
 * The public News index — where a breaking alert lands the reader.
 *
 * Same listing use case as the homepage rails (`cachedLatest`), presented as
 * a feed rather than a front page: newest story leads, the rest follow in
 * published order. Server-rendered under the same cache discipline — the
 * `articles-{locale}` tag busts it the moment anything publishes.
 */
export default function NewsPage({ params }: Params): React.ReactElement {
  return (
    <Suspense fallback={<NewsSkeleton />}>
      <NewsBody params={params} />
    </Suspense>
  )
}

async function NewsBody({ params }: Params): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('nav')

  const { items } = await cachedLatest(locale, PAGE_SIZE)
  const [lead, ...rest] = items

  return (
    <main className="mx-auto w-full max-w-[var(--container-page)] px-4 py-6 md:px-8 md:py-10">
      <header className="reveal signal-grid bg-surface-container-lowest relative mb-12 overflow-hidden border-y-4 border-on-surface px-7 py-14 text-on-surface md:mb-16 md:px-14 md:py-20">
        <div aria-hidden className="absolute bottom-0 right-0 h-4 w-2/3 bg-secondary" />
        <div aria-hidden className="absolute right-8 top-1/2 hidden -translate-y-1/2 text-[11rem] font-black leading-none text-primary/10 md:block">NEWS</div>
        <p className="eyebrow text-primary-ink mb-5">Latest / Ghana / World</p>
        <h1 className="relative max-w-[10ch] font-display text-[3.5rem] leading-[0.9] font-bold tracking-[-0.05em] md:text-[length:var(--text-display-lg)]">
          {t('news')}
        </h1>
        <p className="relative mt-6 max-w-xl border-l-4 border-secondary pl-5 text-lg text-on-surface-variant">The latest reporting, analysis and voices from Ghana and the wider world.</p>
      </header>

      {lead === undefined ? (
        <p className="text-on-surface-variant">Nothing published yet.</p>
      ) : (
        <div className="flex flex-col gap-[var(--space-lg)]">
          <NewsLead article={lead} />

          {rest.length > 0 && (
            <div className="grid grid-cols-1 gap-x-[var(--space-lg)] md:grid-cols-2">
              {rest.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}

/**
 * The most recent story, framed like the section lead: tonal image frame
 * (articles carry no image until the media library, R3), kicker, headline,
 * absolute date. No relative time — a Server Component has no "now", and
 * `cachedLatest` does not capture one the way `cachedSection` does.
 */
function NewsLead({ article }: { article: ArticleView }): React.ReactElement {
  return (
    <article className="editorial-card group max-w-6xl overflow-hidden border-b-[0.75rem] border-secondary bg-inverse-surface text-white">
      <Link href={`/articles/${article.slug}`} className="block">
        <div className="signal-grid bg-primary-container relative aspect-[16/7] w-full overflow-hidden">
          <div className="bg-primary absolute bottom-0 right-[8%] h-full w-1/3 -skew-x-12" />
        </div>
        <div className="p-7 md:p-10">
          <div className="eyebrow text-secondary-ink mb-3">{article.categoryId.replace(/^cat_/u, '')}</div>
          <h2 className="font-display text-3xl font-semibold text-white transition-colors group-hover:text-secondary md:text-[length:var(--text-headline-md)]">{article.title}</h2>
          {article.publishedAt !== null && <time dateTime={article.publishedAt} className="mt-4 block text-sm text-white/55">{formatDate(article.publishedAt, article.locale)}</time>}
        </div>
      </Link>
    </article>
  )
}

/** Same rule as ArticleCard: explicit locale and UTC, or server and client disagree. */
function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

function NewsSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-[var(--container-page)] px-6 py-8 md:py-16" aria-hidden>
      <div className="border-outline-variant mb-12 border-b pb-8">
        <div className="bg-surface-container h-12 w-48 rounded-sm" />
      </div>
      <div className="bg-surface-container aspect-video w-full max-w-3xl rounded-lg" />
    </div>
  )
}
