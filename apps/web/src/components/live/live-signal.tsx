'use client'

import { useEffect, useState } from 'react'
import { LivePlayer } from './live-player'

interface BroadcastStatus { readonly id: string; readonly title: string; readonly playbackUrl: string; readonly captionMode: 'in_band' | 'unverified'; readonly startedAt: string | null }
interface LiveCopy { readonly title: string; readonly description: string; readonly status: string; readonly onAir: string; readonly nowPlaying: string; readonly emptyTitle: string; readonly emptyDescription: string }

export function LiveSignal({ locale, copy }: { locale: string; copy: LiveCopy }): React.ReactElement {
  const [broadcast, setBroadcast] = useState<BroadcastStatus | null>(null)
  useEffect(() => {
    let active = true
    const load = async (): Promise<void> => {
      const response = await fetch(`/api/live-status/${locale}`, { credentials: 'omit' })
      if (response.ok && active) setBroadcast(await response.json() as BroadcastStatus | null)
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 15_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [locale])
  return <div><header className="border-b-4 border-secondary bg-[#08150d] px-7 py-10 text-white md:px-12"><div className="flex flex-wrap items-center justify-between gap-5"><div><p className="eyebrow text-secondary">Kurasikapa Media TV / Accra</p><h1 className="mt-3 font-display text-5xl font-bold tracking-[-.05em] md:text-7xl">{copy.title}</h1></div><span className="flex items-center gap-3 border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[.16em]"><span className={`size-2.5 ${broadcast === null ? 'bg-white/35' : 'animate-pulse bg-secondary'}`} />{broadcast === null ? copy.status : copy.onAir}</span></div></header>{broadcast === null ? <EmptySignal title={copy.emptyTitle} description={copy.emptyDescription} /> : <section className="grid bg-[#050a07] lg:grid-cols-[1fr_19rem]"><LivePlayer source={broadcast.playbackUrl} title={broadcast.title} captionMode={broadcast.captionMode} /><aside className="border-t border-white/15 p-7 text-white lg:border-l lg:border-t-0"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-secondary">{copy.nowPlaying}</p><h2 className="mt-3 font-display text-2xl font-bold leading-tight">{broadcast.title}</h2><p className="mt-4 text-sm leading-6 text-white/55">{copy.description}</p><p className="mt-7 border-t border-white/15 pt-5 text-xs text-white/45">{broadcast.captionMode === 'in_band' ? 'Live captions enabled · ' : 'Caption status unverified · '}{startedAt(broadcast.startedAt, locale)}</p></aside></section>}</div>
}

function EmptySignal({ title, description }: { title: string; description: string }): React.ReactElement { return <section className="signal-grid relative min-h-[25rem] overflow-hidden bg-surface-container-low px-7 py-14 md:px-12"><div aria-hidden className="absolute -bottom-16 right-4 font-display text-[15rem] font-black leading-none text-primary/5">TV</div><div className="relative max-w-2xl border-l-4 border-primary pl-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Next transmission</p><h2 className="mt-4 font-display text-3xl font-bold text-on-surface md:text-5xl">{title}</h2><p className="mt-5 max-w-xl text-base leading-7 text-on-surface-variant">{description}</p></div></section> }
function startedAt(value: string | null, locale: string): string { return value === null ? '' : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
