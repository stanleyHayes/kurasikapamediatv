'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdCampaignView, AdSlotView } from '@kurasikapa/web-kit/bff/revenue'
import { createAdCampaignAction } from '@/actions/revenue'

type Currency = 'GHS' | 'EUR'
type Locale = 'en' | 'fr' | '*'

export function AdvertisingManager({ campaigns }: { readonly campaigns: readonly AdCampaignView[] }): React.ReactElement {
  const router = useRouter()
  const [slot, setSlot] = useState<AdSlotView>('home_leaderboard')
  const [locale, setLocale] = useState<Locale>('en')
  const [currency, setCurrency] = useState<Currency>('GHS')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(data: FormData): Promise<void> {
    setPending(true); setNotice(null)
    const result = await createAdCampaignAction({
      name: value(data, 'name'), advertiser: value(data, 'advertiser'), locale, slot,
      creativeURL: value(data, 'creativeURL'), altText: value(data, 'altText'), landingURL: value(data, 'landingURL'), currency,
      budgetMinor: money(data, 'budget'), cpmMinor: money(data, 'cpm'), priority: Number(data.get('priority')),
      startsAt: iso(data, 'startsAt'), endsAt: iso(data, 'endsAt'),
    })
    if (result.ok) { setNotice('Campaign activated and eligible for its placement window.'); router.refresh() }
    else setNotice(result.error.message)
    setPending(false)
  }

  return <section className="space-y-8" aria-labelledby="advertising-title"><header className="grid gap-5 border-b-4 border-on-surface pb-7 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="broadcast-kicker text-primary">Commercial desk</p><h2 id="advertising-title" className="mt-3 font-display text-4xl font-bold tracking-[-.04em] md:text-5xl">Advertising campaigns</h2><p className="mt-3 max-w-3xl text-on-surface-variant">Schedule clearly disclosed placements without reader profiling. Budget delivery is CPM-based, currency-separated and measured through anonymous events.</p></div><Metric value={campaigns.filter((item) => item.active).length} label="Active campaigns" /></header>
    <div className="grid gap-7 xl:grid-cols-[.9fr_1.1fr]"><form action={(data) => { void submit(data) }} className="space-y-5 border-2 border-outline bg-surface-container-lowest p-6 shadow-[8px_9px_0_rgba(16,75,42,.13)] md:p-8"><div><p className="broadcast-kicker text-secondary-ink">New placement</p><h3 className="mt-2 font-display text-2xl font-semibold">Create and activate a campaign</h3></div><div className="grid gap-4 md:grid-cols-2"><Field label="Campaign name"><input name="name" required placeholder="September launch" className={input} /></Field><Field label="Advertiser"><input name="advertiser" required placeholder="Verified organisation" className={input} /></Field></div><Choice label="Placement" value={slot} options={['home_leaderboard', 'article_inline', 'live_companion']} onChange={(next) => { setSlot(next as AdSlotView) }} /><Choice label="Audience language" value={locale} options={['en', 'fr', '*']} onChange={(next) => { setLocale(next as Locale) }} /><Field label="Creative image URL"><input name="creativeURL" type="url" required placeholder="https://cdn.example.com/campaign.jpg" className={input} /></Field><Field label="Accessible image description"><input name="altText" required minLength={5} maxLength={180} placeholder="Describe the creative, not its filename" className={input} /></Field><Field label="Destination URL"><input name="landingURL" type="url" required placeholder="https://advertiser.example.com/offer" className={input} /></Field><Choice label="Currency" value={currency} options={['GHS', 'EUR']} onChange={(next) => { setCurrency(next as Currency) }} /><div className="grid gap-4 md:grid-cols-3"><MoneyField name="budget" label="Total budget" currency={currency} placeholder="5000.00" /><MoneyField name="cpm" label="CPM rate" currency={currency} placeholder="35.00" /><Field label="Priority"><input name="priority" type="number" min="1" max="100" defaultValue="50" required className={input} /></Field></div><div className="grid gap-4 md:grid-cols-2"><Field label="Starts"><input name="startsAt" type="datetime-local" required className={input} /></Field><Field label="Ends"><input name="endsAt" type="datetime-local" required className={input} /></Field></div>{notice !== null && <p role="status" className="border-l-4 border-secondary bg-secondary-container px-4 py-3 text-sm">{notice}</p>}<button disabled={pending} className="flex min-h-13 w-full items-center justify-between bg-primary px-5 font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-45"><span>{pending ? <>Activating campaign <LoadingDots /></> : 'Create and activate campaign'}</span><span aria-hidden>↗</span></button></form><CampaignReport campaigns={campaigns} /></div>
  </section>
}

function CampaignReport({ campaigns }: { readonly campaigns: readonly AdCampaignView[] }): React.ReactElement {
  if (campaigns.length === 0) return <div className="signal-grid flex min-h-96 items-center justify-center border-2 border-outline bg-surface-container-low p-10 text-center"><div><span aria-hidden className="inline-block animate-pulse text-5xl text-primary">◇</span><h3 className="mt-4 font-display text-2xl font-semibold">No advertising campaigns yet</h3><p className="mt-2 max-w-md text-sm text-on-surface-variant">Create a real campaign to begin building delivery and click-through reporting.</p></div></div>
  return <div className="space-y-4"><div className="grid grid-cols-3 gap-3">{[['Impressions', sum(campaigns, 'impressions')], ['Clicks', sum(campaigns, 'clicks')], ['Avg. CTR', average(campaigns)]].map(([label, figure]) => <div key={label} className="border-2 border-outline bg-surface-container-lowest p-4 shadow-[4px_5px_0_rgba(16,75,42,.1)]"><strong className="block font-display text-2xl">{figure}</strong><span className="text-[.65rem] font-bold uppercase tracking-[.12em] text-on-surface-variant">{label}</span></div>)}</div>{campaigns.map((campaign) => <article key={campaign.id} className="border-2 border-outline bg-surface-container-lowest p-5 shadow-[6px_7px_0_rgba(16,75,42,.1)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="broadcast-kicker text-primary">{label(campaign.slot)}</p><h3 className="mt-2 font-display text-xl font-semibold">{campaign.name}</h3><p className="text-sm text-on-surface-variant">{campaign.advertiser}</p></div><span className="border border-outline px-2 py-1 text-xs font-bold uppercase">{campaign.active ? 'Active' : 'Draft'}</span></div><div className="mt-5 grid grid-cols-2 gap-4 border-t border-outline-variant pt-4 text-sm md:grid-cols-4"><Datum label="Budget" value={format(campaign.budget.minor, campaign.budget.currency)} /><Datum label="Spent" value={format(campaign.estimatedSpendMinor, campaign.budget.currency)} /><Datum label="Impressions" value={campaign.impressions.toLocaleString()} /><Datum label="CTR" value={`${campaign.ctr.toFixed(2)}%`} /></div></article>)}</div>
}

const input = 'h-13 w-full border-2 border-outline bg-surface-container-lowest px-4 focus:border-primary focus:outline-none'
function Field({ label: text, children }: { readonly label: string; readonly children: React.ReactNode }): React.ReactElement { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-on-surface-variant">{text}</span>{children}</label> }
function MoneyField({ name, label: text, currency, placeholder }: { readonly name: string; readonly label: string; readonly currency: Currency; readonly placeholder: string }): React.ReactElement { return <Field label={text}><div className="flex border-2 border-outline focus-within:border-primary"><span className="grid place-items-center px-3 text-xs font-bold text-primary">{currency}</span><input name={name} type="number" min="1" step="0.01" required placeholder={placeholder} className="h-12 min-w-0 flex-1 px-2 outline-none" /></div></Field> }
function Choice({ label: text, value: selected, options, onChange }: { readonly label: string; readonly value: string; readonly options: readonly string[]; readonly onChange: (value: string) => void }): React.ReactElement { return <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-on-surface-variant">{text}</legend><div className="flex flex-wrap border-l-2 border-t-2 border-outline">{options.map((option) => <button key={option} type="button" aria-pressed={selected === option} onClick={() => { onChange(option) }} className={`border-b-2 border-r-2 border-outline px-4 py-3 text-xs font-bold uppercase ${selected === option ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'}`}>{label(option)}</button>)}</div></fieldset> }
function Metric({ value: amount, label: text }: { readonly value: number; readonly label: string }): React.ReactElement { return <div className="border-2 border-outline bg-surface-container-lowest px-6 py-4 shadow-[6px_7px_0_rgba(16,75,42,.12)]"><strong className="block font-display text-3xl">{amount}</strong><span className="text-xs font-bold uppercase tracking-[.12em] text-on-surface-variant">{text}</span></div> }
function Datum({ label: text, value: amount }: { readonly label: string; readonly value: string }): React.ReactElement { return <div><span className="block text-[.65rem] font-bold uppercase tracking-[.12em] text-on-surface-variant">{text}</span><strong className="mt-1 block">{amount}</strong></div> }
function LoadingDots(): React.ReactElement { return <span aria-hidden className="ml-2 inline-flex gap-1"><i className="size-1 animate-bounce rounded-full bg-current"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]"/></span> }
function value(data: FormData, key: string): string { const result = data.get(key); return typeof result === 'string' ? result : '' }
function iso(data: FormData, key: string): string { const raw = value(data, key); const date = new Date(raw); return Number.isNaN(date.valueOf()) ? '' : date.toISOString() }
function money(data: FormData, key: string): number { return Math.round(Number(data.get(key)) * 100) }
function format(minor: number, currency: Currency): string { return new Intl.NumberFormat('en', { style: 'currency', currency }).format(minor / 100) }
function sum(items: readonly AdCampaignView[], key: 'impressions' | 'clicks'): string { return items.reduce((total, item) => total + item[key], 0).toLocaleString() }
function average(items: readonly AdCampaignView[]): string { return `${(items.reduce((total, item) => total + item.ctr, 0) / items.length).toFixed(2)}%` }
function label(value: string): string { return value === '*' ? 'All languages' : value.replaceAll('_', ' ') }
