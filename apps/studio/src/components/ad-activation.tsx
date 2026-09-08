'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AdCampaignDetailView } from '@kurasikapa/web-kit/bff/revenue'
import { activateAdCampaignAction, deactivateAdCampaignAction } from '@/actions/revenue'

/**
 * Going live, and coming back off.
 *
 * Both directions are reversible now, so neither button needs the warning the
 * one-way version carried. What is NOT reversible is spend: impressions served
 * while live are counted against the budget and stay counted, which is why the
 * numbers are worth getting right before the first activation.
 */
export function AdActivation({ campaign }: { campaign: AdCampaignDetailView }): React.ReactElement {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const move = (next: 'activate' | 'pause'): void => { start(async () => {
    const result = next === 'activate'
      ? await activateAdCampaignAction({ id: campaign.id })
      : await deactivateAdCampaignAction({ id: campaign.id })
    setMessage(result.ok ? null : result.error.message)
    if (result.ok) router.refresh()
  }) }

  const everRan = campaign.activatedAt !== null
  const ranFrom = (campaign.activatedAt ?? '').slice(0, 10)

  return (
    <aside className="border border-outline-variant bg-surface-container-lowest p-6">
      <h2 className="font-display text-xl font-bold">Publication</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        {campaign.active
          ? `Serving to readers since ${ranFrom}. Editing the terms above takes effect on the next request — a raised budget simply keeps it running.`
          : everRan
            ? `Paused. It ran from ${ranFrom} and is not serving now. Impressions already counted stay counted against the budget.`
            : 'Not serving. Nothing appears on the site until you publish it. Correct the budget and CPM first — they are what spend is measured against.'}
      </p>

      <button type="button" disabled={pending} onClick={() => { move(campaign.active ? 'pause' : 'activate') }} className={`mt-5 w-full px-4 py-3 text-xs font-bold disabled:cursor-wait disabled:opacity-50 ${campaign.active ? 'border border-outline hover:border-error hover:text-error' : 'bg-primary text-on-primary'}`}>
        {pending ? 'Working…' : campaign.active ? 'Pause this ad' : everRan ? 'Resume this ad' : 'Publish this ad'}
      </button>

      <p className="mt-4 border-l-4 border-secondary bg-secondary-container/30 p-3 text-xs">
        Pausing is reversible and keeps the campaign’s terms. Spend is not: impressions served while live remain counted, and the campaign stops on its own once the budget is reached or {campaign.endsAt.slice(0, 10)} passes.
      </p>
      {message !== null && <p role="alert" className="mt-4 text-sm text-error">{message}</p>}
    </aside>
  )
}
