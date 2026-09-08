import Link from 'next/link'
import type { Route } from 'next'
import type { AdCampaignDetailView } from '@kurasikapa/web-kit/bff/revenue'

const SLOT_LABELS: Readonly<Record<AdCampaignDetailView['slot'], string>> = {
  home_leaderboard: 'Homepage banner', article_inline: 'Inside articles', live_companion: 'Beside live player',
}

const money = (minor: number, currency: string): string => `${currency} ${(minor / 100).toFixed(2)}`

export function AdCampaignList({ campaigns, locale }: { campaigns: readonly AdCampaignDetailView[]; locale: string }): React.ReactElement {
  if (campaigns.length === 0) {
    return (
      <div className="signal-grid border border-outline-variant p-10 text-center">
        <h2 className="font-display text-xl font-bold">No campaigns yet.</h2>
        <p className="mt-2 text-sm text-on-surface-variant">Create one on the Revenue page, then set its budget and publish it here.</p>
      </div>
    )
  }
  const live = campaigns.filter((campaign) => campaign.active).length

  return (
    <section className="space-y-4">
      <p className="text-sm text-on-surface-variant">{campaigns.length - live} not published · {live} live</p>
      <ul className="grid gap-4 lg:grid-cols-2">
        {campaigns.map((campaign) => (
          <li key={campaign.id} className={`border ${campaign.active ? 'border-outline-variant bg-surface-container-low' : 'border-dashed border-secondary bg-secondary-container/20'}`}>
            <Link href={`/${locale}/ads/${campaign.id}` as Route} className="block p-5 transition-colors hover:bg-surface-container">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${campaign.active ? 'bg-primary text-on-primary' : 'bg-secondary text-on-secondary'}`}>{campaign.active ? 'Live' : 'Not published'}</span>
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-primary-ink">{SLOT_LABELS[campaign.slot]}</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold">{campaign.advertiser}</h2>
              <p className="mt-1 text-sm text-on-surface-variant">{campaign.name}</p>
              <p className="mt-3 text-xs text-on-surface-variant">Budget {money(campaign.budget.minor, campaign.budget.currency)} · CPM {money(campaign.cpmMinor, campaign.budget.currency)}</p>
              <span className="mt-4 inline-block text-xs font-bold text-primary">Open →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
