import { setRequestLocale } from 'next-intl/server'
import { StandingPageView } from '@/components/standing-page'
import { pageFor } from '@/content/pages'
import { type StandingParams, staticStandingRoute } from '@/content/standing-route'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'

const route = staticStandingRoute('advertise', 'advertise')
export const generateMetadata = route.generateMetadata

export default async function AdvertisePage({ params }: StandingParams): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  return <StandingPageView page={pageFor('advertise', locale)} pageKey="advertise" locale={locale}>
    <section className="border-t-2 border-on-surface bg-surface-container-low"><div className="mx-auto grid max-w-[var(--container-page)] gap-8 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="broadcast-kicker text-primary">Campaign operations</p><h2 className="mt-4 max-w-[14ch] font-display text-5xl font-semibold tracking-[-.05em]">Already working with Kurasikapa?</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-on-surface-variant">Invited advertisers can submit accessible creative, budgets and campaign timing, then follow the commercial desk’s approval decision in one private workspace.</p></div><Link href="/advertise/portal" className="flex min-h-14 items-center justify-between gap-10 bg-primary px-6 font-bold text-on-primary shadow-[6px_7px_0_var(--color-secondary)]"><span>Open advertiser workspace</span><span aria-hidden>→</span></Link></div></section>
  </StandingPageView>
}
