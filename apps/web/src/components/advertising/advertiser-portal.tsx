'use client'

import { useState, useTransition } from 'react'
import type { AdvertiserProposalView, AdSlotView } from '@kurasikapa/web-kit/bff/revenue'
import { submitAdvertiserProposalAction } from '@/actions/revenue-actions'

type Locale = 'en' | 'fr' | '*'
type Currency = 'GHS' | 'EUR'

const input = 'h-13 w-full border border-outline bg-surface-container-lowest px-4 text-sm outline-none transition-shadow focus:shadow-[inset_4px_0_0_var(--color-primary)]'

export function AdvertiserPortal({ initial }: { readonly initial: readonly AdvertiserProposalView[] }): React.ReactElement {
  const [items, setItems] = useState(initial)
  const [slot, setSlot] = useState<AdSlotView>('home_leaderboard')
  const [locale, setLocale] = useState<Locale>('en')
  const [currency, setCurrency] = useState<Currency>('GHS')
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = (form: FormData): void => {
    setNotice(null)
    start(async () => {
      const result = await submitAdvertiserProposalAction({
        contactName: value(form, 'contactName'), contactEmail: value(form, 'contactEmail'),
        name: value(form, 'name'), advertiser: value(form, 'advertiser'), locale, slot,
        creativeURL: value(form, 'creativeURL'), altText: value(form, 'altText'),
        landingURL: value(form, 'landingURL'), currency,
        budgetMinor: money(form, 'budget'), cpmMinor: money(form, 'cpm'),
        priority: Number(form.get('priority')), startsAt: iso(form, 'startsAt'), endsAt: iso(form, 'endsAt'),
      })
      if (!result.ok) {
        setNotice(result.error.message)
        return
      }
      setItems((current) => [result.data, ...current])
      setNotice('Your proposal is now with the commercial desk for review.')
    })
  }

  return <div className="space-y-12">
    <PortalHeader count={items.length}/>
    <div className="grid gap-10 xl:grid-cols-[1.08fr_.92fr]">
      <form action={(data) => { submit(data) }} className="space-y-6 border-2 border-outline bg-surface-container-lowest p-6 shadow-[10px_11px_0_rgba(16,75,42,.12)] md:p-9">
        <div><p className="broadcast-kicker text-secondary-ink">Campaign brief</p><h2 className="mt-2 font-display text-3xl font-semibold">Send a placement for review</h2></div>
        <div className="grid gap-4 md:grid-cols-2"><Field label="Contact name" icon="◎"><input name="contactName" required placeholder="Ama Mensah" autoComplete="name" className={input}/></Field><Field label="Contact email" icon="@"><input name="contactEmail" type="email" required placeholder="ama@company.com" autoComplete="email" className={input}/></Field></div>
        <div className="grid gap-4 md:grid-cols-2"><Field label="Campaign name" icon="◆"><input name="name" required placeholder="September audience launch" className={input}/></Field><Field label="Organisation" icon="▦"><input name="advertiser" required placeholder="Verified organisation" className={input}/></Field></div>
        <Choice label="Placement" value={slot} options={['home_leaderboard', 'article_inline', 'live_companion']} onChange={(next) => { setSlot(next as AdSlotView) }}/>
        <Choice label="Audience language" value={locale} options={['en', 'fr', '*']} onChange={(next) => { setLocale(next as Locale) }}/>
        <Field label="Creative image URL" icon="▧"><input name="creativeURL" type="url" required placeholder="https://cdn.company.com/campaign.jpg" className={input}/></Field>
        <Field label="Accessible image description" icon="Aa"><input name="altText" required minLength={5} maxLength={180} placeholder="Describe what the campaign image communicates" className={input}/></Field>
        <Field label="Destination URL" icon="↗"><input name="landingURL" type="url" required placeholder="https://company.com/campaign" className={input}/></Field>
        <Choice label="Billing currency" value={currency} options={['GHS', 'EUR']} onChange={(next) => { setCurrency(next as Currency) }}/>
        <div className="grid gap-4 md:grid-cols-3"><Field label={`Budget (${currency})`} icon="¤"><input name="budget" inputMode="decimal" required placeholder="5000.00" className={input}/></Field><Field label={`CPM (${currency})`} icon="‰"><input name="cpm" inputMode="decimal" required placeholder="35.00" className={input}/></Field><Field label="Priority" icon="#"><input name="priority" type="number" min="1" max="100" defaultValue="50" required className={input}/></Field></div>
        <div className="grid gap-4 md:grid-cols-2"><Field label="Starts" icon="▶"><input name="startsAt" type="datetime-local" required className={input}/></Field><Field label="Ends" icon="■"><input name="endsAt" type="datetime-local" required className={input}/></Field></div>
        {notice !== null && <p role="status" className="border-l-4 border-secondary bg-secondary-container px-4 py-3 text-sm">{notice}</p>}
        <button disabled={pending} className="flex min-h-14 w-full items-center justify-between bg-primary px-6 font-bold text-on-primary transition-transform active:translate-y-px disabled:cursor-wait disabled:opacity-55"><span aria-hidden>◇</span><span>{pending ? <>Submitting proposal <LoadingDots/></> : 'Submit for commercial review'}</span><span aria-hidden>→</span></button>
      </form>
      <ProposalHistory items={items}/>
    </div>
  </div>
}

function PortalHeader({ count }: { readonly count: number }): React.ReactElement { return <header className="grid gap-6 border-b-4 border-on-surface pb-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="broadcast-kicker text-primary">Advertiser workspace</p><h1 className="mt-3 max-w-4xl font-display text-5xl font-semibold tracking-[-.05em] md:text-7xl">Plan a campaign without bypassing review.</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-on-surface-variant">Submit accessible creative, timing and budget details. The commercial desk reviews every placement before anything appears to readers.</p></div><div className="border-2 border-outline bg-secondary-container px-6 py-5 shadow-[6px_7px_0_rgba(16,75,42,.12)]"><strong className="block font-display text-4xl">{count}</strong><span className="text-xs font-bold uppercase tracking-[.16em]">Your proposals</span></div></header> }

function ProposalHistory({ items }: { readonly items: readonly AdvertiserProposalView[] }): React.ReactElement {
  if (items.length === 0) return <section className="signal-grid flex min-h-[34rem] items-center justify-center border-2 border-outline bg-surface-container-low p-8 text-center"><div><span aria-hidden className="inline-block animate-[pulse_1.8s_ease-in-out_infinite] text-6xl text-primary">◇</span><h2 className="mt-5 font-display text-3xl font-semibold">No campaign proposals yet</h2><p className="mt-3 max-w-sm leading-7 text-on-surface-variant">Your submitted campaigns, review notes and activation status will appear here.</p></div></section>
  return <section aria-labelledby="proposal-history-title" className="space-y-4"><div><p className="broadcast-kicker text-primary">Review trail</p><h2 id="proposal-history-title" className="mt-2 font-display text-3xl font-semibold">Your proposals</h2></div>{items.map((item) => <article key={item.id} className="border-2 border-outline bg-surface-container-lowest p-5 shadow-[6px_7px_0_rgba(16,75,42,.1)]"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">{slotLabel(item.campaign.slot)}</p><h3 className="mt-2 font-display text-2xl font-semibold">{item.campaign.name}</h3><p className="mt-1 text-sm text-on-surface-variant">{item.campaign.advertiser}</p></div><Status value={item.status}/></div><dl className="mt-5 grid grid-cols-2 gap-4 border-t border-outline-variant pt-4 text-sm"><Datum label="Budget" value={formatMoney(item.campaign.budget)}/><Datum label="Runs" value={`${date(item.campaign.startsAt)} – ${date(item.campaign.endsAt)}`}/></dl>{item.reviewNote !== '' && <p className="mt-4 border-l-4 border-secondary bg-secondary-container p-3 text-sm"><strong>Review note:</strong> {item.reviewNote}</p>}</article>)}</section>
}

function Field({ label, icon, children }: { readonly label: string; readonly icon: string; readonly children: React.ReactNode }): React.ReactElement { return <label className="block"><span className="mb-2 flex items-center gap-2 text-sm font-semibold"><span aria-hidden className="text-primary">{icon}</span>{label}</span>{children}</label> }
function Choice({ label, value, options, onChange }: { readonly label: string; readonly value: string; readonly options: readonly string[]; readonly onChange: (value: string) => void }): React.ReactElement { return <fieldset><legend className="mb-2 text-sm font-semibold">{label}</legend><div className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr">{options.map((option) => <button key={option} type="button" aria-pressed={value === option} onClick={() => { onChange(option) }} className={`min-h-11 border px-3 text-xs font-bold uppercase tracking-[.1em] ${value === option ? 'border-primary bg-primary text-on-primary shadow-[3px_4px_0_var(--color-secondary)]' : 'border-outline bg-surface-container-lowest'}`}>{choiceLabel(option)}</button>)}</div></fieldset> }
function Status({ value }: { readonly value: AdvertiserProposalView['status'] }): React.ReactElement { return <span className={`border px-3 py-1 text-xs font-bold uppercase tracking-[.12em] ${value === 'approved' ? 'border-primary bg-primary text-on-primary' : value === 'rejected' ? 'border-error text-error' : 'border-secondary bg-secondary-container'}`}>{value}</span> }
function Datum({ label, value }: { readonly label: string; readonly value: string }): React.ReactElement { return <div><dt className="text-[.65rem] font-bold uppercase tracking-[.12em] text-on-surface-variant">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div> }
function LoadingDots(): React.ReactElement { return <span aria-hidden className="ml-2 inline-flex gap-1"><i className="size-1 animate-bounce rounded-full bg-current"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]"/></span> }
function value(form: FormData, key: string): string { const item = form.get(key); return typeof item === 'string' ? item : '' }
function money(form: FormData, key: string): number { return Math.round(Number(value(form, key)) * 100) }
function iso(form: FormData, key: string): string { const dateValue = new Date(value(form, key)); return Number.isNaN(dateValue.valueOf()) ? '' : dateValue.toISOString() }
function formatMoney(value: AdvertiserProposalView['campaign']['budget']): string { return new Intl.NumberFormat('en-GH', { style: 'currency', currency: value.currency }).format(value.minor / 100) }
function date(value: string): string { const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? 'To be confirmed' : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(parsed) }
function choiceLabel(value: string): string { return value === '*' ? 'All languages' : value.replaceAll('_', ' ') }
function slotLabel(value: AdSlotView): string { return value.replaceAll('_', ' ') }
