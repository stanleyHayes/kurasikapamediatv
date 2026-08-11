import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { BriefingCard } from '@/components/home/briefing-card'
import { Hero } from '@/components/home/hero'
import { Trending } from '@/components/home/trending'
import { Link } from '@/i18n/navigation'
import { homeRails, type HomeRails } from '@/read-model/home-rails'
import { cachedLatest, cachedMostRead } from '@/read-model/queries'

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
    return (
      <p className="text-on-surface-variant py-[var(--spacing-xl)]">
        Nothing published yet.
      </p>
    )
  }

  return <HomeLayout {...homeRails(items, mostRead)} />
}

function HomeLayout({ lead, briefing, trending }: HomeRails): React.ReactElement {
  return (
    <>
      {lead !== undefined && <Hero article={lead} />}

      <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-lg)]">
        <div className="grid grid-cols-1 gap-[var(--spacing-lg)] lg:grid-cols-12">
          <div className="flex flex-col gap-8 lg:col-span-8">
            <div className="border-outline-variant flex items-end justify-between border-b pb-4">
              <h2 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
                Editor&rsquo;s Briefing
              </h2>
              <Link
                href="/search"
                className="text-label-bold text-on-surface-variant hover:text-secondary uppercase transition-colors"
              >
                View all
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-[var(--spacing-md)] md:grid-cols-2">
              {briefing.map((article) => (
                <BriefingCard key={article.id} article={article} />
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

      {/* The design's gradient hairline between regions. */}
      <div className="mx-auto max-w-[var(--container-page)] px-6 py-8">
        <div className="via-outline-variant h-px w-full bg-gradient-to-r from-transparent to-transparent" />
      </div>
    </>
  )
}

function HomeSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-md)]" aria-hidden>
      <div className="bg-surface-container h-[480px] rounded-xl md:h-[640px]" />
    </div>
  )
}
