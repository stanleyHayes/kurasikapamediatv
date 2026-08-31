import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { BriefingCard } from '@/components/home/briefing-card'
import { Hero } from '@/components/home/hero'
import { Trending } from '@/components/home/trending'
import { EditorialEmptyState } from '@/components/editorial-empty-state'
import { AdPlacement } from '@/components/advertising/ad-placement'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { homeRails, type HomeRails } from '@kurasikapa/web-kit/read-model/home-rails'
import { cachedLatest, cachedMostRead } from '@kurasikapa/web-kit/read-model/queries'

/** Lead + four briefing cards + three trending, per the Stitch composition. */
const RAIL_SIZE = 8

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <Suspense fallback={<HomeSkeleton />}>
      <Front locale={locale} />
    </Suspense>
  )
}

async function Front({ locale }: { locale: string }): Promise<React.ReactElement> {
  const [{ items }, mostRead] = await Promise.all([
    cachedLatest(locale, RAIL_SIZE),
    cachedMostRead(locale, RAIL_SIZE),
  ])
  if (items.length === 0) {
    return <EditorialEmptyState surface="home" />
  }

  return <HomeLayout {...homeRails(items, mostRead)} locale={locale} />
}

function HomeLayout({ lead, briefing, trending, locale }: HomeRails & { readonly locale: string }): React.ReactElement {
  return (
    <>
      {lead !== undefined && <Hero article={lead} />}

      <Suspense fallback={null}><AdPlacement locale={locale} slot="home_leaderboard" /></Suspense>

      <section className="mx-auto max-w-[var(--container-page)] px-4 py-[var(--space-xl)] md:px-8">
        <div className="grid grid-cols-1 gap-[var(--space-lg)] lg:grid-cols-12">
          <div className="flex flex-col gap-8 lg:col-span-8">
            <div className="reveal flex items-end justify-between gap-4 border-b-4 border-on-surface pb-5">
              <h2 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
                The briefing
              </h2>
              <Link
                href="/search"
                className="editorial-link eyebrow text-primary-ink hover:text-secondary-ink transition-colors"
              >
                View all
              </Link>
            </div>

            <div className="depth-grid grid grid-cols-1 gap-x-[var(--space-md)] gap-y-10 md:grid-cols-2">
              {briefing.map((article, index) => (
                <BriefingCard key={article.id} article={article} index={index} />
              ))}
            </div>
          </div>

          {trending.length > 0 && (
            <div className="lg:col-span-4">
              <Trending articles={trending} />
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[var(--container-page)] px-6 py-8">
        <div className="bg-outline-variant h-px w-full" />
      </div>
    </>
  )
}

function HomeSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--space-md)]" aria-hidden>
      <div className="bg-surface-container h-[480px] rounded-xl md:h-[640px]" />
    </div>
  )
}
