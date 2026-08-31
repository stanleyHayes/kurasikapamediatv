import { setRequestLocale } from 'next-intl/server'
import { SupportCentre } from '@/components/support/support-centre'
import { loadMembershipPlans } from '@kurasikapa/web-kit/bff/revenue'

export const metadata = { title: 'Support independent journalism', description: 'Join or contribute to Kurasikapa Media TV reporting.' }

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const plans = await loadMembershipPlans(locale)
  return <main className="mx-auto max-w-[var(--container-page)] px-5 py-12 md:px-8 md:py-20">
    <header className="mb-14 grid gap-7 border-y-4 border-on-surface py-10 lg:grid-cols-[1.25fr_.75fr] lg:items-end"><div><p className="eyebrow text-primary">Reader-supported newsroom</p><h1 className="mt-5 max-w-[11ch] font-display text-[length:var(--text-display-lg)] font-semibold leading-[.92]">Keep public-interest journalism in public view.</h1></div><p className="border-l-4 border-secondary pl-5 text-lg leading-8 text-on-surface-variant">Choose recurring membership or make a one-time contribution. Payments are handled by Paystack in Ghana cedis and Stripe in euros; Kurasikapa stores no card details.</p></header>
    <SupportCentre plans={plans} locale={locale} />
  </main>
}
