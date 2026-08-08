import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { currentActor } from '@/composition/actor'

/**
 * The studio is behind authentication. Reading the session is request data, so
 * it happens inside a Suspense boundary — otherwise it blocks the prerendered
 * chrome and the whole route becomes a blank wait.
 *
 * The guard wraps `children` rather than running above them: a Server
 * Component's children are elements, not results, so the page below only
 * executes once the guard has admitted it.
 */
export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="py-[var(--spacing-lg)]">
      <header className="border-outline-variant mb-[var(--spacing-md)] border-b pb-[var(--spacing-md)]">
        <p className="text-label-bold text-secondary uppercase">Studio</p>
        <h1 className="font-display text-on-surface mt-1 text-[length:var(--text-headline-md)] font-semibold">
          Newsroom
        </h1>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <RequireNewsroom locale={locale}>{children}</RequireNewsroom>
      </Suspense>
    </div>
  )
}

async function RequireNewsroom({
  locale,
  children,
}: {
  locale: string
  children: React.ReactNode
}): Promise<React.ReactNode> {
  const actor = await currentActor()

  // Anyone who cannot draft has no business in a UI built for the newsroom.
  // This is convenience, not security: every action re-derives the Actor and
  // lets the domain decide, so a hand-crafted POST is refused regardless.
  if (!actor?.can('article:draft')) redirect(`/${locale}`)

  return children
}

function ListSkeleton(): React.ReactElement {
  return (
    <div aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="border-outline-variant flex items-center gap-4 border-b px-2 py-4">
          <div className="bg-surface-container h-6 w-20 rounded-lg" />
          <div className="bg-surface-container h-4 flex-1 rounded-sm" />
        </div>
      ))}
    </div>
  )
}
