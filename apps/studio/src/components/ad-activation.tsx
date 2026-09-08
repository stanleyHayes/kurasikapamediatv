'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AdCampaignDetailView } from '@kurasikapa/web-kit/bff/revenue'
import { activateAdCampaignAction } from '@/actions/revenue'

/**
 * Going live, on its own, beside the terms.
 *
 * There is no deactivate use case: once a campaign is active it runs until its
 * end date or its budget is spent. That is stated plainly here rather than
 * discovered afterwards, and it is why saving and activating are two buttons.
 */
export function AdActivation({ campaign }: { campaign: AdCampaignDetailView }): React.ReactElement {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const activate = (): void => {
    if (!window.confirm(`Put “${campaign.name}” live now? It will serve to readers until ${campaign.endsAt.slice(0, 10)} or its budget is spent, and it cannot be paused.`)) return
    start(async () => {
      const result = await activateAdCampaignAction({ id: campaign.id })
      setMessage(result.ok ? null : result.error.message)
      if (result.ok) router.refresh()
    })
  }

  return (
    <aside className="border border-outline-variant bg-surface-container-lowest p-6">
      <h2 className="font-display text-xl font-bold">Publication</h2>
      {campaign.active
        ? <p className="mt-2 text-sm text-on-surface-variant">Live since {(campaign.activatedAt ?? '').slice(0, 10)}. Editing the terms above takes effect immediately — a raised budget simply keeps it serving.</p>
        : <p className="mt-2 text-sm text-on-surface-variant">Not serving. Nothing appears on the site until you publish it. Correct the budget and CPM first — they are what the spend is measured against.</p>}
      {!campaign.active && (
        <button type="button" disabled={pending} onClick={activate} className="mt-5 w-full bg-primary px-4 py-3 text-xs font-bold text-on-primary disabled:cursor-wait disabled:opacity-50">
          {pending ? 'Publishing…' : 'Publish this ad'}
        </button>
      )}
      <p className="mt-4 border-l-4 border-secondary bg-secondary-container/30 p-3 text-xs">There is no pause. Once live, a campaign runs to its end date or until its budget is exhausted.</p>
      {message !== null && <p role="alert" className="mt-4 text-sm text-error">{message}</p>}
    </aside>
  )
}
