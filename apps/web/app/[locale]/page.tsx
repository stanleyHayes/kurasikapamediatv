import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { ArticleCard } from '@/components/article-card'
import { cachedLatest } from '@/read-model/queries'

const RAIL_SIZE = 12

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('home')

  return (
    <>
      {/* Static shell — prerendered, served from the edge immediately. */}
      <section className="py-[var(--spacing-xl)]">
        <h1 className="font-display text-primary text-[length:var(--text-display-lg)] leading-[1.1] font-bold tracking-[-0.02em]">
          {t('latest')}
        </h1>
      </section>

      {/* Cached — revalidates in minutes, invalidated on publish by tag. */}
      <Suspense fallback={<RailSkeleton />}>
        <LatestRail locale={locale} />
      </Suspense>
    </>
  )
}

async function LatestRail({ locale }: { locale: string }): Promise<React.ReactElement> {
  const { items } = await cachedLatest(locale, RAIL_SIZE)

  return (
    <section className="pb-[var(--spacing-xl)]">
      {items.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </section>
  )
}

function RailSkeleton(): React.ReactElement {
  return (
    <div className="pb-[var(--spacing-xl)]" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="border-outline-variant border-b py-6">
          <div className="bg-surface-container h-3 w-24 rounded-sm" />
          <div className="bg-surface-container mt-3 h-7 w-2/3 rounded-sm" />
        </div>
      ))}
    </div>
  )
}
