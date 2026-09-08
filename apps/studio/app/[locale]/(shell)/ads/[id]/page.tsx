import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadAdCampaign } from '@kurasikapa/web-kit/bff/revenue'
import { AdCampaignForm } from '@/components/ad-campaign-form'
import { AdActivation } from '@/components/ad-activation'

/** One campaign: its terms, with publication beside them. */
export default async function AdPage({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<React.ReactElement> {
  const { locale, id } = await params
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  const campaign = await loadAdCampaign(actor, id)
  if (campaign === null) notFound()

  return (
    <div className="space-y-7">
      <header className="border-b border-outline-variant pb-6">
        <Link href={`/${locale}/ads` as Route} className="text-xs font-bold text-primary">← Ads</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${campaign.active ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>{campaign.active ? 'Live' : 'Not published'}</span>
          <h1 className="font-display text-4xl font-bold tracking-tight">{campaign.advertiser}</h1>
        </div>
      </header>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
        <AdCampaignForm campaign={campaign} />
        <AdActivation campaign={campaign} locale={locale} />
      </div>
    </div>
  )
}
