'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AffiliateLinkView } from '@kurasikapa/web-kit/bff/revenue'
import { createAffiliateLinkAction } from '@/actions/revenue'

const field = 'min-h-13 w-full border-2 border-outline bg-surface px-4 outline-none focus:border-primary'

export function AffiliateManager({ links }: { readonly links: readonly AffiliateLinkView[] }): React.ReactElement {
  const router = useRouter(); const [pending, setPending] = useState(false); const [notice, setNotice] = useState<string | null>(null)
  async function create(data: FormData): Promise<void> {
    setPending(true); setNotice(null)
    const result = await createAffiliateLinkAction(Object.fromEntries(data.entries()))
    setNotice(result.ok ? 'Affiliate recommendation published with disclosure.' : result.error.message)
    setPending(false); if (result.ok) router.refresh()
  }
  return <section className="space-y-8" aria-labelledby="affiliate-title"><header className="border-b-4 border-on-surface pb-6"><p className="broadcast-kicker text-primary">Partner commerce</p><h2 id="affiliate-title" className="mt-3 font-display text-5xl font-semibold">Affiliate recommendations</h2><p className="mt-3 max-w-2xl text-on-surface-variant">Publish approved partner links with visible commercial disclosure. Reader follows are counted without collecting identity.</p></header><div className="grid gap-8 xl:grid-cols-[.9fr_1.1fr]"><form action={(data) => { void create(data) }} className="space-y-4 border-2 border-outline bg-surface-container-lowest p-6"><h3 className="font-display text-2xl font-semibold">Add recommendation</h3><input className={field} name="partner" required placeholder="Partner name"/><input className={field} name="title" required placeholder="Recommendation title"/><input className={field} name="category" required placeholder="Category"/><textarea className={`${field} min-h-28 py-3`} name="description" required minLength={20} placeholder="Why this is useful to readers"/><input className={field} name="imageURL" required type="url" placeholder="https:// image"/><input className={field} name="imageAlt" required placeholder="Image alternative text"/><input className={field} name="destinationURL" required type="url" placeholder="https:// tracked destination"/><input className={field} name="disclosure" required placeholder="Affiliate disclosure shown to readers"/><input className={field} name="commissionNote" placeholder="Internal commission note (optional)"/><button className="min-h-13 w-full bg-primary px-5 font-bold text-on-primary disabled:opacity-45" disabled={pending}>{pending ? 'Publishing •••' : 'Publish recommendation'}</button></form><section><h3 className="font-display text-2xl font-semibold">Partner inventory</h3>{links.length === 0 ? <div className="signal-grid mt-4 border-2 border-outline p-8 text-center"><span aria-hidden className="inline-block animate-pulse text-4xl text-primary">◇</span><p className="mt-3 text-on-surface-variant">Approved partner recommendations will appear here.</p></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{links.map((link) => <article key={link.id} className="border-2 border-outline bg-surface-container-lowest p-5"><p className="text-xs font-bold uppercase text-primary">{link.category} · {link.active ? 'Live' : 'Draft'}</p><h4 className="mt-2 font-display text-xl font-semibold">{link.title}</h4><p className="mt-2 text-sm text-on-surface-variant">{link.partner}</p><p className="mt-4 font-bold">{link.clicks.toLocaleString()} tracked follows</p></article>)}</div>}</section></div>{notice && <p role="status" className="border-l-4 border-secondary bg-secondary-container p-4">{notice}</p>}</section>
}
