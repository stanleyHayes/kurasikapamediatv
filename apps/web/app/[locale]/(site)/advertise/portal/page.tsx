import { setRequestLocale } from 'next-intl/server'
import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AdvertiserPortal } from '@/components/advertising/advertiser-portal'
import { currentActor } from '@kurasikapa/web-kit/composition/actor'
import { loadAdvertiserProposals } from '@kurasikapa/web-kit/bff/revenue'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'

export default function AdvertiserPortalPage({ params }: { readonly params: Promise<{ locale: string }> }): React.ReactElement {
  return <main className="mx-auto max-w-[var(--container-page)] px-4 py-12 md:px-8 md:py-20"><Suspense fallback={<PortalSkeleton/>}><Portal params={params}/></Suspense></main>
}

async function Portal({ params }: { readonly params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const actor = await currentActor()
  if (actor === null) redirect(`/${locale}/advertise/portal/sign-in` as Route)
  if (!actor.can('campaign:view_own')) return <section className="signal-grid flex min-h-[34rem] items-center justify-center border-2 border-outline bg-surface-container-low p-8 text-center"><div><span aria-hidden className="text-6xl text-primary">◇</span><h1 className="mt-5 font-display text-4xl font-semibold">Advertiser access is invitation-only</h1><p className="mx-auto mt-4 max-w-lg leading-7 text-on-surface-variant">Your account is signed in, but it has not been assigned the advertiser role. Ask the commercial desk to invite this account.</p><Link href="/contact" className="mt-7 inline-flex min-h-12 items-center gap-8 bg-primary px-5 font-bold text-on-primary">Contact the commercial desk <span aria-hidden>→</span></Link></div></section>
  return <AdvertiserPortal initial={await loadAdvertiserProposals(actor)}/>
}

function PortalSkeleton(): React.ReactElement { return <div aria-hidden className="animate-pulse"><div className="h-44 border-b-4 border-outline bg-surface-container"/><div className="mt-10 grid gap-8 lg:grid-cols-2"><div className="h-[42rem] bg-surface-container"/><div className="h-[34rem] bg-surface-container-low"/></div></div> }
