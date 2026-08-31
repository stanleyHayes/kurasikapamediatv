import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { StudioShell } from '@/components/studio-shell'
import { currentActor } from '@kurasikapa/web-kit/composition/actor'
import { env } from '@kurasikapa/web-kit/composition/env'
import { siteUrl, studioUrl } from '@kurasikapa/web-kit/composition/origins'
import { externalRoute } from '@/external-route'

/**
 * The studio app shell, per the Stitch editorial CMS: a docked 256px rail and
 * a scrolling canvas under a contextual top bar. `h-screen overflow-hidden`
 * with the canvas scrolling independently is what makes the rail stay put.
 *
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
    <div className="bg-surface flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      <a href="#studio-content" className="skip-link">Skip to workspace</a>
      <Suspense fallback={<RailSkeleton />}>
        <Guarded locale={locale}>{children}</Guarded>
      </Suspense>
    </div>
  )
}

async function Guarded({
  locale,
  children,
}: {
  locale: string
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const actor = await currentActor()

  // Anyone who cannot draft has no business in a UI built for the newsroom.
  // This is convenience, not security: every action re-derives the Actor and
  // lets the domain decide, so a hand-crafted POST is refused regardless.
  //
  // Signed-out goes to sign-in; signed-in-but-unauthorised goes home. Sending
  // the second case to sign-in would loop them through a form that cannot
  // help — they are already who they are.
  //
  // Both destinations are absolute. The signed-out path now stays on this
  // deployment because a provider-owned Vercel host cannot share cookies with
  // the public site's domain; unauthorised readers still return to the site.
  if (actor === null) redirect(externalRoute(`${studioUrl(env())}/${locale}/sign-in`))
  if (!actor.can('article:draft')) redirect(externalRoute(`${siteUrl(env())}/${locale}`))

  return (
    <>
      {/* Rendered inside the boundary, not in the prerendered shell: it holds
          the sign-out control, and "sign out" has no meaning for the visitor
          who sees a prerendered page. */}
      <StudioShell locale={locale}>{children}</StudioShell>
    </>
  )
}

function RailSkeleton(): React.ReactElement {
  return (
    <div className="flex h-full w-full" aria-hidden>
      <div className="border-outline-variant bg-surface-container-low hidden w-64 shrink-0 border-r p-4 md:block">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-surface-container mb-3 h-9 rounded-lg" />
        ))}
      </div>
      <div className="flex-1 p-6">
        <div className="bg-surface-container h-24 rounded-xl" />
      </div>
    </div>
  )
}
