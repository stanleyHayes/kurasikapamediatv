import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { ArticleCard } from '@/components/article-card'
import { StoryVisual } from '@/components/story/story-visual'
import { EditorialEmptyState } from '@/components/editorial-empty-state'
import { ArticleMeta } from '@/components/story/article-meta'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import type { CardArticleView } from '@kurasikapa/web-kit/read-model/article-view'
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
      <header className="reveal signal-grid bg-surface-container-lowest relative mb-10 overflow-hidden border-y-4 border-on-surface px-7 py-10 text-on-surface md:px-14 md:py-12">
        <div aria-hidden className="absolute bottom-0 right-0 h-4 w-2/3 bg-secondary" />
        <div aria-hidden className="absolute right-8 top-1/2 hidden -translate-y-1/2 text-[8rem] font-black leading-none text-primary/10 md:block">NEWS</div>
        <p className="eyebrow text-primary-ink mb-3">Latest / Ghana / World</p>
        <h1 className="relative max-w-[10ch] font-display text-[3.5rem] leading-[0.9] font-bold tracking-[-0.05em] md:text-[4.5rem]">
          {t('news')}
        </h1>
        <p className="relative mt-4 max-w-xl border-l-4 border-secondary pl-5 text-base text-on-surface-variant">The latest reporting, analysis and voices from Ghana and the wider world.</p>
      </header>

      {lead === undefined ? (
        <EditorialEmptyState surface="news" />
      ) : (
        <div className="flex flex-col gap-[var(--space-lg)]">
          <NewsLead article={lead} />

          {rest.length > 0 && (
            <div className="depth-grid grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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
function NewsLead({ article }: { article: CardArticleView }): React.ReactElement {
  return (
    <article className="editorial-card group overflow-hidden border border-outline-variant bg-inverse-surface text-white">
      <Link href={`/articles/${article.slug}`} className="grid lg:grid-cols-[.85fr_1.15fr]">
        <StoryVisual article={article} large />
        <div className="flex flex-col p-7 md:p-10">
          <div className="eyebrow text-secondary mb-3">{article.categoryId.replace(/^cat_/u, '')}</div>
          <h2 className="font-display text-3xl font-semibold leading-[1.02] text-white transition-colors group-hover:text-secondary md:text-[length:var(--text-headline-md)]">{article.title}</h2>
          {article.excerpt !== null && <p className="mt-5 line-clamp-3 text-base leading-relaxed text-white/65">{article.excerpt}</p>}
          <div className="mt-auto border-t border-white/20 pt-6"><ArticleMeta article={article} inverse /></div>
        </div>
      </Link>
    </article>
  )
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
