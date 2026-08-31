'use client'

import Image from 'next/image'
import { useEffect } from 'react'
import type { AdPlacementView, AdSlotView } from '@kurasikapa/web-kit/bff/revenue'
import { recordAdEventAction } from '@/actions/revenue-actions'

export function AdDelivery({ placement, slot }: { readonly placement: AdPlacementView; readonly slot: AdSlotView }): React.ReactElement {
  useEffect(() => { void recordAdEventAction({ campaignId: placement.id, kind: 'impression' }) }, [placement.id])
  return <aside aria-label={`Advertisement from ${placement.advertiser}`} className={`mx-auto w-full max-w-[var(--container-page)] px-4 md:px-8 ${slot === 'article_inline' ? 'my-10' : 'my-8'}`}><div className="border-2 border-outline bg-surface-container-lowest p-2 shadow-[7px_8px_0_rgba(16,75,42,.12)]"><div className="flex items-center justify-between border-b border-outline-variant px-2 py-2"><span className="text-[.62rem] font-bold uppercase tracking-[.2em] text-on-surface-variant">Advertisement</span><span className="text-[.62rem] text-on-surface-variant">Paid placement · {placement.advertiser}</span></div><a href={placement.landingUrl} target="_blank" rel="sponsored nofollow noopener" onClick={() => { void recordAdEventAction({ campaignId: placement.id, kind: 'click' }) }} className="group relative mt-2 block aspect-[4/1] min-h-28 overflow-hidden bg-surface-container-low"><Image src={placement.creativeUrl} alt={placement.altText} fill unoptimized sizes="(max-width: 768px) 100vw, 1200px" className="object-cover transition-transform duration-500 group-hover:scale-[1.015]"/><span className="absolute bottom-3 right-3 border border-white/60 bg-black/75 px-3 py-2 text-xs font-bold text-white">Visit advertiser <span aria-hidden>↗</span></span></a></div></aside>
}
