import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadAdCampaigns } from '@kurasikapa/web-kit/bff/revenue'
import { AdCampaignList } from '@/components/ad-campaign-list'

/** The advertising index — every campaign, live or not. */
export default async function AdsPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  const campaigns = await loadAdCampaigns(actor)

  return (
    <div className="space-y-7">
      <header className="border-b border-outline-variant pb-6">
        <p className="broadcast-kicker text-primary">Advertising</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">Ads</h1>
        <p className="mt-3 max-w-3xl text-on-surface-variant">Set an advertiser’s budget and rate, then publish the placement. Nothing serves to readers until you do.</p>
      </header>
      <AdCampaignList campaigns={campaigns} locale={locale} />
    </div>
  )
}
