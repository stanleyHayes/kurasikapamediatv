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
    <main className="mx-auto w-full max-w-[var(--container-page)] px-6 py-8 md:py-16">
      <header className="border-outline-variant mb-12 border-b pb-8">
        <h1 className="font-display text-on-surface text-[2.5rem] leading-[1.1] font-bold tracking-[-0.02em] md:text-[length:var(--text-display-lg)]">
          {t('news')}
        </h1>
      </header>

      {lead === undefined ? (
        <p className="text-on-surface-variant">Nothing published yet.</p>
      ) : (
        <div className="flex flex-col gap-[var(--spacing-lg)]">
          <NewsLead article={lead} />

          {rest.length > 0 && (
            <div className="grid grid-cols-1 gap-x-[var(--spacing-lg)] md:grid-cols-2">
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
    <article className="group max-w-3xl">
      <Link href={`/articles/${article.slug}`} className="block">
        <div className="border-outline-variant/40 bg-surface-container-low mb-6 rounded-lg border p-1">
          <div className="bg-surface-container aspect-video w-full rounded" />
        </div>

        <div className="text-label-bold text-secondary mb-2 uppercase" style={{ letterSpacing: '0.1em' }}>
          {article.categoryId.replace(/^cat_/u, '')}
        </div>

        <h2 className="font-display text-on-surface group-hover:text-primary text-[length:var(--text-headline-md)] font-semibold transition-colors">
          {article.title}
        </h2>

        {article.publishedAt !== null && (
          <time dateTime={article.publishedAt} className="text-on-surface-variant mt-3 block text-sm">
            {formatDate(article.publishedAt, article.locale)}
          </time>
        )}
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
