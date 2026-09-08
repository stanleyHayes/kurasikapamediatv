'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AdCampaignDetailView } from '@kurasikapa/web-kit/bff/revenue'
import { updateAdCampaignAction } from '@/actions/revenue'

const SLOTS = [['home_leaderboard', 'Homepage banner'], ['article_inline', 'Inside articles'], ['live_companion', 'Beside the live player']] as const
const LOCALES = [['*', 'Both languages'], ['en', 'English only'], ['fr', 'French only']] as const

/** Minor units are the storage unit; editors think in whole currency. */
const toMajor = (minor: number): string => (minor / 100).toFixed(2)
const toMinor = (major: string): number => Math.round(Number(major) * 100)

/**
 * Corrects a campaign's terms.
 *
 * Saving never changes whether the campaign is live — that is `Activate`, next
 * to this form. Splitting them is what lets a placeholder budget be fixed
 * before anyone commits the placement to readers.
 */
export function AdCampaignForm({ campaign }: { campaign: AdCampaignDetailView }): React.ReactElement {
  const router = useRouter()
  const [slot, setSlot] = useState(campaign.slot)
  const [audience, setAudience] = useState<string>(campaign.locale)
  const [currency, setCurrency] = useState(campaign.budget.currency)
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  const submit = (data: FormData): void => { start(async () => {
    const result = await updateAdCampaignAction(campaign.id, {
      name: text(data, 'name'), advertiser: text(data, 'advertiser'), locale: audience, slot,
      creativeURL: text(data, 'creativeURL'), altText: text(data, 'altText'), landingURL: text(data, 'landingURL'),
      currency, budgetMinor: toMinor(text(data, 'budget')), cpmMinor: toMinor(text(data, 'cpm')),
      priority: Number(text(data, 'priority')),
      startsAt: new Date(text(data, 'startsAt')).toISOString(),
      endsAt: new Date(text(data, 'endsAt')).toISOString(),
    })
    if (!result.ok) { setMessage(result.error.message); setSaved(false); return }
    setMessage(null); setSaved(true); router.refresh()
  }) }

  return (
    <form action={submit} className="space-y-5">
      <Field name="name" label="Campaign name" defaultValue={campaign.name} />
      <Field name="advertiser" label="Advertiser" defaultValue={campaign.advertiser} />
      <Picker label="Placement" items={SLOTS} selected={slot} onSelect={(id) => { setSlot(id as typeof slot) }} />
      <Picker label="Audience language" items={LOCALES} selected={audience} onSelect={setAudience} />
      <Field name="creativeURL" label="Creative image URL" type="url" defaultValue={campaign.creativeUrl} />
      <Field name="altText" label="Accessible image description" defaultValue={campaign.altText} />
      <Field name="landingURL" label="Destination URL" type="url" defaultValue={campaign.landingUrl} />
      <Picker label="Currency" items={[['GHS', 'Ghana cedi'], ['EUR', 'Euro']]} selected={currency} onSelect={(id) => { setCurrency(id as typeof currency) }} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field name="budget" label={`Total budget (${currency})`} type="number" step="0.01" defaultValue={toMajor(campaign.budget.minor)} />
        <Field name="cpm" label={`CPM rate (${currency})`} type="number" step="0.01" defaultValue={toMajor(campaign.cpmMinor)} />
        <Field name="priority" label="Priority (1–100)" type="number" defaultValue={String(campaign.priority)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="startsAt" label="Starts" type="datetime-local" defaultValue={campaign.startsAt.slice(0, 16)} />
        <Field name="endsAt" label="Ends" type="datetime-local" defaultValue={campaign.endsAt.slice(0, 16)} />
      </div>
      <button disabled={pending} className="bg-primary px-5 py-3 text-sm font-bold text-on-primary disabled:cursor-wait disabled:opacity-45">{pending ? 'Saving…' : 'Save changes'}</button>
      {saved && <p role="status" className="border-l-4 border-primary bg-primary/10 p-3 text-sm">Saved. Activation is unchanged — use the panel beside this form to go live.</p>}
      {message !== null && <p role="alert" className="border-l-4 border-error bg-error-container/30 p-3 text-sm">{message}</p>}
    </form>
  )
}

function text(data: FormData, name: string): string {
  const item = data.get(name)

  return typeof item === 'string' ? item : ''
}

function Field({ name, label, defaultValue, type = 'text', step }: { name: string; label: string; defaultValue: string; type?: string; step?: string }): React.ReactElement {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</span><input name={name} type={type} step={step} required defaultValue={defaultValue} className="h-12 w-full border border-outline-variant bg-surface px-4 focus:border-primary focus:outline-none"/></label>
}

function Picker({ label, items, selected, onSelect }: { label: string; items: readonly (readonly [string, string])[]; selected: string; onSelect: (id: string) => void }): React.ReactElement {
  return <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</legend><div className="flex flex-wrap gap-2">{items.map(([id, itemLabel]) => <button key={id} type="button" aria-pressed={selected === id} onClick={() => { onSelect(id) }} className={`border px-3 py-2 text-xs font-bold ${selected === id ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant hover:border-primary'}`}>{itemLabel}</button>)}</div></fieldset>
}
