import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { LeadStory } from '@/components/section/lead-story'
import { SectionCard } from '@/components/section/section-card'
import { SectionSidebar } from '@/components/section/section-sidebar'
import { cachedSection } from '@kurasikapa/web-kit/read-model/queries'

interface Params {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  const section = await cachedSection(slug, locale)

  if (section === null) return { title: 'Not found', robots: { index: false } }

  return {
    title: section.name,
    ...(section.description === null ? {} : { description: section.description }),
    alternates: { canonical: `/${locale}/sections/${slug}` },
  }
}

/** Soft-404 caveat as on the article page — see its comment. */
export default function SectionPage({ params }: Params): React.ReactElement {
  return (
    <Suspense fallback={<SectionSkeleton />}>
      <SectionBody params={params} />
    </Suspense>
  )
}

async function SectionBody({ params }: Params): Promise<React.ReactElement> {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const section = await cachedSection(slug, locale)
  if (section === null) notFound()

  // The design's composition: one lead story, the rest as a two-column grid,
  // and the sidebar's trending rail drawn from the same sequence. A section is
  // one editorial ordering, not three independent feeds.
  const [lead, ...rest] = section.articles
  const secondary = rest.slice(0, 4)
  const trending = rest.slice(4, 7)

  return (
    <main className="mx-auto w-full max-w-[var(--container-page)] px-4 py-6 md:px-8 md:py-10">
      <header className="reveal signal-grid bg-primary relative mb-12 overflow-hidden border-r-[0.75rem] border-secondary px-7 py-16 text-white md:mb-16 md:px-14 md:py-24">
        <div aria-hidden className="absolute -bottom-16 right-4 text-[22rem] font-black leading-none text-white/10">{section.name.slice(0, 1)}</div>
        <p className="eyebrow text-secondary-container mb-5">Section desk / Kurasikapa</p>
        <h1 className="relative font-display mb-4 text-[3.5rem] leading-[0.9] font-bold tracking-[-0.05em] md:text-[length:var(--text-display-lg)]">
          {section.name}
        </h1>

        {section.description !== null && (
          <p className="relative max-w-3xl text-[length:var(--text-body-lg)] text-white/68">
            {section.description}
          </p>
        )}
      </header>

      {lead === undefined ? (
        <p className="text-on-surface-variant">Nothing published in this section yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--space-lg)] lg:grid-cols-12">
          <div className="flex flex-col gap-12 md:gap-16 lg:col-span-8">
            <LeadStory article={lead} now={section.now} />

            {secondary.length > 0 && (
              <div className="grid grid-cols-1 gap-[var(--space-md)] md:grid-cols-2">
                {secondary.map((article) => (
                  <SectionCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <SectionSidebar name={section.name} trending={trending} />
          </div>
        </div>
      )}
    </main>
  )
}

function SectionSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-[var(--container-page)] px-6 py-8 md:py-16" aria-hidden>
      <div className="border-outline-variant mb-12 border-b pb-8">
        <div className="bg-surface-container h-12 w-64 rounded-sm" />
        <div className="bg-surface-container mt-4 h-4 w-2/3 rounded-sm" />
      </div>
      <div className="bg-surface-container aspect-video w-full max-w-2xl rounded-lg" />
    </div>
  )
}
