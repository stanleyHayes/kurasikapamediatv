'use client'

import { useState } from 'react'
import type { MembershipPlanView } from '@kurasikapa/web-kit/bff/revenue'
import { startDonationAction, startMembershipAction } from '@/actions/revenue-actions'

type Currency = 'GHS' | 'EUR'

export function SupportCentre({ plans, locale }: { readonly plans: readonly MembershipPlanView[]; readonly locale: string }): React.ReactElement {
  const [email, setEmail] = useState('')
  const [currency, setCurrency] = useState<Currency>('GHS')
  const [amount, setAmount] = useState(5000)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const local = locale === 'fr' ? 'fr' : 'en'

  async function membership(planID: string): Promise<void> {
    setBusy(planID); setMessage(null)
    const result = await startMembershipAction({ planID, email, locale: local })
    if (result.ok) window.location.assign(result.data.checkoutURL)
    else {
      setMessage(result.error.code === 'not_signed_in' ? 'Sign in before starting a membership.' : result.error.message)
      setBusy(null)
    }
  }

  async function donate(form: FormData): Promise<void> {
    setBusy('donation'); setMessage(null)
    const result = await startDonationAction({ amountMinor: amount, currency, email,
      message: formText(form, 'message'), anonymous: form.get('anonymous') === 'on', locale: local })
    if (result.ok) window.location.assign(result.data.checkoutURL)
    else { setMessage(result.error.message); setBusy(null) }
  }

  return <div className="space-y-16">
    <section aria-labelledby="membership-title">
      <div className="mb-7 grid gap-4 border-b-4 border-on-surface pb-6 md:grid-cols-[1fr_auto] md:items-end">
        <div><p className="eyebrow text-primary">Membership</p><h2 id="membership-title" className="mt-2 font-display text-4xl font-semibold">Back journalism that stays accountable.</h2></div>
        <p className="max-w-md text-sm leading-6 text-on-surface-variant">Membership is recurring support. Your access begins only after the payment provider confirms the transaction.</p>
      </div>
      <label className="mb-6 block max-w-xl"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em]">Membership email</span><span className="flex items-center border-2 border-outline bg-surface px-4 focus-within:border-primary"><span aria-hidden className="text-primary">@</span><input value={email} onChange={(event) => { setEmail(event.target.value) }} required type="email" autoComplete="email" placeholder="you@example.com" className="h-14 w-full border-0 bg-transparent px-3 outline-none" /></span></label>
      {plans.length > 0 ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{plans.map((plan, index) => <article key={plan.id} className={`broadcast-shadow flex min-h-[390px] flex-col border-2 p-6 ${index === 1 ? 'border-secondary bg-inverse-surface text-white' : 'border-outline bg-surface-container-lowest'}`}>
        <p className={`text-xs font-bold uppercase tracking-[.14em] ${index === 1 ? 'text-secondary' : 'text-primary'}`}>Tier {String(index + 1).padStart(2, '0')}</p><h3 className="mt-5 font-display text-3xl font-semibold">{plan.name}</h3><p className={`mt-3 text-sm leading-6 ${index === 1 ? 'text-white/70' : 'text-on-surface-variant'}`}>{plan.description}</p><p className="mt-7"><strong className="font-display text-5xl">{format(plan.price.minor, plan.price.currency)}</strong><span className="ml-2 text-sm opacity-70">/{plan.interval === 'yearly' ? 'year' : 'month'}</span></p><ul className="my-7 space-y-3 text-sm">{plan.benefits.map((benefit) => <li key={benefit} className="flex gap-3"><span aria-hidden className="text-secondary">◆</span>{benefit}</li>)}</ul><button type="button" onClick={() => { void membership(plan.id) }} disabled={busy !== null || email === ''} className={`mt-auto flex min-h-12 items-center justify-between px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45 ${index === 1 ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary'}`}><span>{busy === plan.id ? <>Opening checkout <LoadingDots /></> : 'Choose membership'}</span><span aria-hidden>↗</span></button>
      </article>)}</div> : <EmptyPlans />}
    </section>

    <section className="grid overflow-hidden border-4 border-on-surface lg:grid-cols-[.8fr_1.2fr]" aria-labelledby="donation-title"><div className="signal-grid bg-secondary-container p-8 md:p-12"><p className="eyebrow text-primary">One-time support</p><h2 id="donation-title" className="mt-4 max-w-[10ch] font-display text-5xl font-semibold">Fund the next original report.</h2><p className="mt-6 max-w-md leading-7 text-on-surface-variant">Contributions support field reporting, verification, captions and public-interest investigations.</p></div><form action={(data) => { void donate(data) }} className="space-y-6 bg-surface-container-lowest p-8 md:p-12">
      <fieldset><legend className="mb-3 text-xs font-bold uppercase tracking-[.12em]">Currency</legend><div className="inline-flex border-2 border-outline">{(['GHS', 'EUR'] as const).map((value) => <button key={value} type="button" aria-pressed={currency === value} onClick={() => { setCurrency(value); setAmount(value === 'GHS' ? 5000 : 1000) }} className={`px-6 py-3 text-sm font-bold ${currency === value ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'}`}>{value}</button>)}</div></fieldset>
      <fieldset><legend className="mb-3 text-xs font-bold uppercase tracking-[.12em]">Amount</legend><div className="grid grid-cols-3 gap-2">{amounts(currency).map((value) => <button key={value} type="button" aria-pressed={amount === value} onClick={() => { setAmount(value) }} className={`border-2 px-3 py-3 text-sm font-bold ${amount === value ? 'border-primary bg-primary-container text-primary-ink' : 'border-outline bg-surface'}`}>{format(value, currency)}</button>)}</div></fieldset>
      <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em]">Email</span><input value={email} onChange={(event) => { setEmail(event.target.value) }} required type="email" placeholder="Receipt email" className="h-14 w-full border-2 border-outline bg-surface px-4 focus:border-primary focus:outline-none" /></label>
      <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em]">Message (optional)</span><textarea name="message" maxLength={500} placeholder="Why independent reporting matters to you" className="min-h-28 w-full border-2 border-outline bg-surface p-4 focus:border-primary focus:outline-none" /></label>
      <label className="flex items-center gap-3 text-sm"><input name="anonymous" type="checkbox" className="size-5 accent-primary" />Keep my name private if supporters are acknowledged</label>
      {message !== null && <p role="alert" className="border-l-4 border-error bg-error-container px-4 py-3 text-sm text-on-error-container">{message}</p>}
      <button disabled={busy !== null || email === ''} className="flex min-h-14 w-full items-center justify-between bg-primary px-6 font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-45"><span>{busy === 'donation' ? <>Preparing secure checkout <LoadingDots /></> : 'Continue to secure checkout'}</span><span aria-hidden>↗</span></button>
    </form></section>
  </div>
}

function EmptyPlans(): React.ReactElement { return <div className="signal-grid border-2 border-outline bg-surface-container-low p-10 text-center"><span aria-hidden className="inline-block animate-pulse text-5xl text-primary">◈</span><h3 className="mt-4 font-display text-2xl font-semibold">Membership tiers are being prepared</h3><p className="mx-auto mt-2 max-w-lg text-on-surface-variant">You can still make a one-time contribution below. Recurring plans will appear here after the newsroom activates them.</p></div> }
function amounts(currency: Currency): readonly number[] { return currency === 'GHS' ? [2000, 5000, 10000] : [500, 1000, 2500] }
function format(minor: number, currency: Currency): string { return new Intl.NumberFormat(currency === 'GHS' ? 'en-GH' : 'en-IE', { style: 'currency', currency }).format(minor / 100) }
function LoadingDots(): React.ReactElement { return <span aria-hidden className="ml-2 inline-flex gap-1"><i className="size-1 animate-bounce rounded-full bg-current"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]"/></span> }
function formText(form: FormData, key: string): string { const value = form.get(key); return typeof value === 'string' ? value : '' }
