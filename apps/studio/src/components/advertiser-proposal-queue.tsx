'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AdvertiserProposalView } from '@kurasikapa/web-kit/bff/revenue'
import { approveAdvertiserProposalAction, rejectAdvertiserProposalAction } from '@/actions/revenue'

export function AdvertiserProposalQueue({ proposals }: { readonly proposals: readonly AdvertiserProposalView[] }): React.ReactElement {
  return <section className="space-y-7" aria-labelledby="proposal-queue-title"><header className="border-b-4 border-on-surface pb-7"><p className="broadcast-kicker text-primary">Commercial approvals</p><h2 id="proposal-queue-title" className="mt-3 font-display text-4xl font-bold tracking-[-.04em] md:text-5xl">Advertiser proposal queue</h2><p className="mt-3 max-w-3xl text-on-surface-variant">Review advertiser-submitted creative, placement dates and budgets before a campaign can enter the active inventory.</p></header>{proposals.length === 0 ? <EmptyQueue /> : <div className="grid gap-6 xl:grid-cols-2">{proposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal}/>)}</div>}</section>
}

function ProposalCard({ proposal }: { readonly proposal: AdvertiserProposalView }): React.ReactElement {
  const router = useRouter()
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  async function approve(): Promise<void> {
    setPending('approve'); setNotice(null)
    const result = await approveAdvertiserProposalAction({ id: proposal.id })
    setNotice(result.ok ? 'Proposal approved and campaign activated.' : result.error.message)
    setPending(null); if (result.ok) router.refresh()
  }
  async function reject(data: FormData): Promise<void> {
    setPending('reject'); setNotice(null)
    const result = await rejectAdvertiserProposalAction({ id: proposal.id, note: data.get('note') })
    setNotice(result.ok ? 'Proposal returned to the advertiser with your note.' : result.error.message)
    setPending(null); if (result.ok) router.refresh()
  }
  const campaign = proposal.campaign
  return <article className="border-2 border-outline bg-surface-container-lowest p-6 shadow-[8px_9px_0_rgba(16,75,42,.13)]"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="broadcast-kicker text-secondary-ink">{label(campaign.slot)} · {label(campaign.locale)}</p><h3 className="mt-2 font-display text-2xl font-semibold">{campaign.name}</h3><p className="mt-1 text-sm text-on-surface-variant">{campaign.advertiser} · {proposal.contactName} · {proposal.contactEmail}</p></div><span className="border border-outline px-2 py-1 text-xs font-bold uppercase">Submitted</span></div><dl className="mt-6 grid grid-cols-2 gap-4 border-y border-outline-variant py-5 text-sm md:grid-cols-4"><Datum term="Budget" value={money(campaign.budget.minor, campaign.budget.currency)}/><Datum term="CPM" value={money(campaign.cpmMinor, campaign.budget.currency)}/><Datum term="Starts" value={date(campaign.startsAt)}/><Datum term="Ends" value={date(campaign.endsAt)}/></dl><div className="mt-5 space-y-2"><a className="font-bold text-primary underline underline-offset-4" href={campaign.creativeURL} target="_blank" rel="noreferrer">Review campaign creative ↗</a><p className="text-sm text-on-surface-variant">{campaign.altText}</p><a className="block break-all text-sm text-primary underline underline-offset-4" href={campaign.landingURL} target="_blank" rel="noreferrer">{campaign.landingURL}</a></div><div className="mt-6 grid gap-3 md:grid-cols-2"><button type="button" disabled={pending !== null} onClick={() => { void approve() }} className="min-h-12 bg-primary px-5 font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-45">{pending === 'approve' ? <>Approving <LoadingDots/></> : 'Approve and activate →'}</button><form action={(data) => { void reject(data) }} className="flex"><input name="note" required minLength={10} maxLength={500} placeholder="Reason for returning proposal" aria-label="Rejection note" className="min-w-0 flex-1 border-2 border-outline px-3 outline-none focus:border-primary"/><button disabled={pending !== null} className="min-h-12 border-2 border-on-surface px-4 font-bold disabled:cursor-not-allowed disabled:opacity-45">{pending === 'reject' ? <>Sending <LoadingDots/></> : 'Return'}</button></form></div>{notice !== null && <p role="status" className="mt-4 border-l-4 border-secondary bg-secondary-container px-4 py-3 text-sm">{notice}</p>}</article>
}

function EmptyQueue(): React.ReactElement { return <div className="signal-grid flex min-h-80 items-center justify-center border-2 border-outline bg-surface-container-low p-8 text-center"><div><span aria-hidden className="inline-block animate-[pulse_1.8s_ease-in-out_infinite] text-6xl text-primary">◇</span><h3 className="mt-5 font-display text-3xl font-semibold">The review queue is clear</h3><p className="mt-3 max-w-md leading-7 text-on-surface-variant">New advertiser proposals will appear here with their creative, schedule and budget ready for review.</p></div></div> }
function Datum({ term, value }: { readonly term: string; readonly value: string }): React.ReactElement { return <div><dt className="text-[.65rem] font-bold uppercase tracking-[.12em] text-on-surface-variant">{term}</dt><dd className="mt-1 font-semibold">{value}</dd></div> }
function LoadingDots(): React.ReactElement { return <span aria-hidden className="ml-2 inline-flex gap-1"><i className="size-1 animate-bounce rounded-full bg-current"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:120ms]"/><i className="size-1 animate-bounce rounded-full bg-current [animation-delay:240ms]"/></span> }
function label(value: string): string { return value === '*' ? 'All languages' : value.replaceAll('_', ' ') }
function date(value: string): string { return new Intl.DateTimeFormat('en-GH', { dateStyle: 'medium' }).format(new Date(value)) }
function money(minor: number, currency: string): string { return new Intl.NumberFormat('en-GH', { style: 'currency', currency }).format(minor / 100) }
