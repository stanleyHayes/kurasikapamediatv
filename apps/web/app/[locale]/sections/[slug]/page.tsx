import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ArticleCard } from '@/components/article-card'
import { cachedSection } from '@/read-model/queries'

interface Params {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  const section = await cachedSection(slug, locale)

  if (section === null) return { title: 'Not found', robots: { index: false } }

  return {
    title: section.name,
    alternates: { canonical: `/${locale}/sections/${slug}` },
  }
}

/** Soft-404 caveat as on the article page — see its comment. */
export default function SectionPage({ params }: Params): React.ReactElement {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-lg)]" aria-hidden />}>
      <SectionBody params={params} />
    </Suspense>
  )
}

async function SectionBody({ params }: Params): Promise<React.ReactElement> {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const section = await cachedSection(slug, locale)
  if (section === null) notFound()

  return (
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-lg)]">
      <h1 className="font-display text-primary text-[length:var(--text-headline-md)] font-semibold">
        {section.name}
      </h1>

      <div className="mt-[var(--spacing-md)]">
        {section.articles.length === 0 ? (
          <p className="text-on-surface-variant">Nothing published in this section yet.</p>
        ) : (
          section.articles.map((article) => <ArticleCard key={article.id} article={article} />)
        )}
      </div>
    </section>
  )
}

