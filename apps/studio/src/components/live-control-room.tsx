'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { endBroadcastAction, startBroadcastAction, type EncoderCredentials } from '@/actions/live'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { activeAfterStart, endControlLabel } from '@/live/control-state'
import type { ActionError } from '@kurasikapa/web-kit/actions/result'
import { StudioEmptyState } from './empty-state'

interface CurrentBroadcast { readonly id: string; readonly title: string; readonly startedAt: string | null }
interface BroadcastRow extends CurrentBroadcast { readonly state: string; readonly endedAt: string | null }
interface LiveControlActions {
  readonly start: typeof startBroadcastAction
  readonly end: typeof endBroadcastAction
}
const serverActions: LiveControlActions = { start: startBroadcastAction, end: endBroadcastAction }

export function LiveControlRoom({ locale, current, history, actions = serverActions }: { locale: string; current: CurrentBroadcast | null; history: readonly BroadcastRow[]; actions?: LiveControlActions }): React.ReactElement {
  const [active, setActive] = useState(current)
  const [credentials, setCredentials] = useState<EncoderCredentials | null>(null)
  const [error, setError] = useState<ActionError | null>(null); const [pending, startTransition] = useTransition()
  const router = useRouter()
  useEffect(() => {
    setActive(current)
    const timer = window.setInterval(() => { router.refresh() }, 15_000)
    return () => { window.clearInterval(timer) }
  }, [current, router])
  const start = (formData: FormData): void => {
    startTransition(async () => {
      setError(null)
      const title = formData.get('title')
      const result = await actions.start({ title, locale, captionsConfirmed: formData.get('captionsConfirmed') === 'on' })
      if (!result.ok) setError(result.error)
      else {
        setCredentials(result.data)
        setActive(activeAfterStart(title, result.data, new Date().toISOString()))
      }
    })
  }
  const end = (): void => {
    if (active === null) return
    startTransition(async () => {
      setError(null)
      const result = await actions.end({ broadcastId: active.id, locale })
      if (!result.ok) setError(result.error)
      else {
        setActive(null)
        setCredentials(null)
      }
    })
  }
  return <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
    <section className="border border-outline-variant bg-surface-container-lowest p-6 md:p-8">
      <p className="broadcast-kicker text-primary">Transmission control</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4"><h2 className="font-display text-3xl font-bold text-on-surface">{active === null ? 'Prepare the next broadcast' : 'The station is on air'}</h2><LocaleSelector locale={locale} /></div>
      {active === null ? <form action={start} className="mt-8 space-y-6">
        <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.14em]">Programme title</span><input name="title" required minLength={3} maxLength={120} placeholder="Evening bulletin — Accra" className="w-full border border-outline bg-surface px-4 py-4 text-lg outline-none focus:border-primary" /></label>
        <label className="flex gap-3 border-2 border-outline bg-surface-container-low p-4 text-sm leading-6"><input name="captionsConfirmed" type="checkbox" required className="mt-1 size-5 accent-primary"/><span><strong className="block text-on-surface">Live captions are active in the encoder</strong><span className="text-on-surface-variant">Confirm the OBS caption source is embedded in the outgoing stream. The channel cannot be provisioned without this accessibility check.</span></span></label>
        <button disabled={pending} className="bg-primary px-6 py-4 text-sm font-bold uppercase tracking-[.12em] text-on-primary disabled:opacity-50">{pending ? 'Provisioning…' : 'Provision channel'}</button>
      </form> : <div className="mt-8 border-l-4 border-secondary bg-primary px-6 py-5 text-on-primary"><p className="text-xs font-bold uppercase tracking-[.16em] text-secondary">Live now</p><p className="mt-2 text-2xl font-bold">{active.title}</p><p className="mt-2 text-sm text-white/65">Started {formatDate(active.startedAt, locale)}</p><button onClick={end} disabled={pending} className="mt-6 border border-white/50 px-5 py-3 text-xs font-bold uppercase tracking-[.12em] hover:bg-white hover:text-primary">{endControlLabel(pending, error?.message ?? null)}</button></div>}
      <ControlError error={error} />
    </section>
    <SafetyPanel />
    {credentials !== null && <Credentials credentials={credentials} onClear={() => { setCredentials(null); }} />}
    <BroadcastHistory rows={history} locale={locale} />
  </div>
}

function Credentials({ credentials, onClear }: { credentials: EncoderCredentials; onClear: () => void }): React.ReactElement {
  return <section className="border-4 border-secondary bg-inverse-surface p-6 text-white xl:col-span-2" aria-live="polite"><p className="text-xs font-bold uppercase tracking-[.18em] text-secondary">Show once — encoder credentials</p><h2 className="mt-2 font-display text-3xl font-bold">Copy these into OBS now</h2><p className="mt-3 max-w-3xl text-sm text-white/60">The stream key is not stored. Leaving or dismissing this panel means it cannot be recovered; end this broadcast and provision another channel if it is lost.</p><dl className="mt-7 grid gap-5 md:grid-cols-2"><Credential label="Server" value={credentials.ingestEndpoint} /><Credential label="Stream key" value={credentials.streamKey} secret /></dl><button onClick={onClear} className="mt-7 border border-white/30 px-5 py-3 text-xs font-bold uppercase tracking-[.12em] hover:border-secondary">I have saved these securely</button></section>
}

function Credential({ label, value, secret = false }: { label: string; value: string; secret?: boolean }): React.ReactElement {
  const [visible, setVisible] = useState(!secret)
  return <div><dt className="text-[10px] font-bold uppercase tracking-[.16em] text-white/45">{label}</dt><dd className="mt-2 flex border border-white/20 bg-black/25"><code className="min-w-0 flex-1 overflow-x-auto p-4 text-sm">{visible ? value : '••••••••••••••••'}</code>{secret && <button onClick={() => { setVisible((shown) => !shown); }} className="border-l border-white/20 px-4 text-xs font-bold uppercase">{visible ? 'Hide' : 'Reveal'}</button>}</dd></div>
}

function SafetyPanel(): React.ReactElement { return <aside className="border-t-8 border-secondary bg-surface-container p-6"><p className="broadcast-kicker text-primary">Before air</p><ol className="mt-5 space-y-4 text-sm text-on-surface-variant"><li><strong className="text-on-surface">01.</strong> Confirm microphone, camera, programme title and live caption source.</li><li><strong className="text-on-surface">02.</strong> Use OBS streaming service Custom and paste both values.</li><li><strong className="text-on-surface">03.</strong> Start streaming in OBS, then verify picture, sound and the CC control on the public Live page.</li><li><strong className="text-on-surface">04.</strong> End here after the programme to tear down the billable channel.</li></ol></aside> }

function CleanupAlert({ error }: { error: ActionError & { channelArn: string } }): React.ReactElement { return <section role="alert" className="mt-5 border-4 border-error bg-error-container p-5 text-on-error-container"><p className="text-xs font-bold uppercase tracking-[.14em]">AWS cleanup required</p><p className="mt-2 text-sm">The broadcast was not recorded and its IVS channel could not be deleted automatically. Delete this channel in the AWS IVS console now so it cannot keep billing.</p><label className="mt-4 block text-[10px] font-bold uppercase tracking-[.14em]">Channel ARN<input readOnly value={error.channelArn} onFocus={(event) => { event.currentTarget.select() }} className="mt-2 w-full border border-error bg-white px-3 py-3 font-mono text-xs text-black" /></label><p className="mt-3 text-xs">AWS Console → Interactive Video Service → Channels → match this ARN → Delete.</p></section> }

function ControlError({ error }: { error: ActionError | null }): React.ReactElement | null {
  if (error === null) return null
  if (error.code === 'cleanup_required' && error.channelArn !== undefined) {
    return <CleanupAlert error={{ ...error, channelArn: error.channelArn }} />
  }
  return <p role="alert" className="mt-5 border-l-4 border-error bg-error-container px-4 py-3 text-sm text-on-error-container">{error.message}</p>
}

function BroadcastHistory({ rows, locale }: { rows: readonly BroadcastRow[]; locale: string }): React.ReactElement {
  return <section className="border border-outline-variant bg-surface-container-lowest p-6 xl:col-span-2"><div className="flex items-end justify-between gap-4"><div><p className="broadcast-kicker text-primary">Transmission ledger</p><h2 className="mt-1 font-display text-2xl font-bold">Recent broadcasts</h2></div><span className="text-xs text-on-surface-variant">Latest 10</span></div>{rows.length === 0 ? <StudioEmptyState eyebrow="Transmission history" icon="live" title="The broadcast ledger is clear." description="Completed and active programmes in this language will appear here after the first channel is provisioned." compact /> : <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[38rem] text-left text-sm"><thead className="border-b border-outline-variant text-[10px] uppercase tracking-[.14em] text-on-surface-variant"><tr><th scope="col" className="py-3">Programme</th><th scope="col">Status</th><th scope="col">Started</th><th scope="col">Ended</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-outline-variant/60"><td className="py-4 pr-4 font-semibold">{row.title}</td><td><span className="border border-outline px-2 py-1 text-[10px] font-bold uppercase">{row.state}</span></td><td>{formatDate(row.startedAt, locale)}</td><td>{formatDate(row.endedAt, locale)}</td></tr>)}</tbody></table></div>}</section>
}

function LocaleSelector({ locale }: { locale: string }): React.ReactElement { return <div className="flex border border-outline" aria-label="Broadcast language">{(['en', 'fr'] as const).map((option) => <Link key={option} href="/live-control" locale={option} aria-current={locale === option ? 'page' : undefined} className={`px-3 py-2 text-xs font-bold uppercase ${locale === option ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'}`}>{option}</Link>)}</div> }

function formatDate(value: string | null, locale: string): string { return value === null ? '—' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
