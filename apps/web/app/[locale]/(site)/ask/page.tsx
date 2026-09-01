import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import { FormSubmitButton } from '@kurasikapa/ui/form-submit-button'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { searchReporting } from '@kurasikapa/web-kit/read-model/queries'
import { currentActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { callerKey, limit } from '@kurasikapa/web-kit/security/rate-limit'
import { askCopy } from '@/components/ask-newsroom-copy'

interface Props {
  readonly params: Promise<{ locale: string }>
  readonly searchParams: Promise<{ q?: string }>
}

export default async function AskPage(props: Props): Promise<React.ReactElement> {
  const { locale } = await props.params
  setRequestLocale(locale)
  const copy = askCopy(locale)

  return <main className="signal-grid border-b border-outline"><section className="mx-auto max-w-[var(--container-page)] px-5 py-16 md:px-8 md:py-24"><div className="grid gap-12 lg:grid-cols-[minmax(0,.8fr)_minmax(22rem,1.2fr)]"><header><p className="broadcast-kicker text-primary">{copy.eyebrow}</p><h1 className="mt-5 max-w-[10ch] font-display text-6xl font-semibold leading-[.9] tracking-[-.06em] md:text-8xl">{copy.title}</h1><p className="mt-7 max-w-xl text-lg leading-relaxed text-on-surface-variant">{copy.description}</p><p className="mt-8 border-l-4 border-secondary pl-4 text-sm font-semibold text-on-surface-variant">{copy.trust}</p></header><div className="border-2 border-on-surface bg-surface-container-lowest shadow-[10px_10px_0_var(--color-outline)]"><form action={`/${locale}/ask`} className="border-b-2 border-on-surface p-5 md:p-7"><label className="block text-xs font-bold uppercase tracking-[.16em] text-primary" htmlFor="ask-question">{copy.label}</label><textarea id="ask-question" name="q" required minLength={3} rows={4} placeholder={copy.placeholder} className="mt-4 w-full resize-y border-2 border-outline bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-on-surface-variant/60 focus:border-primary"/><FormSubmitButton pendingLabel={copy.pending} className="mt-4 w-full bg-primary px-5 py-3 font-bold text-on-primary transition-colors hover:bg-on-surface disabled:cursor-wait disabled:opacity-50">{copy.action} <span aria-hidden>→</span></FormSubmitButton></form><Suspense fallback={<div className="p-7 text-sm text-on-surface-variant">{copy.loading}<span className="loading-dots" aria-hidden>...</span></div>}><Answer searchParams={props.searchParams} locale={locale}/></Suspense></div></div></section></main>
}

async function Answer({ searchParams, locale }: { readonly searchParams: Props['searchParams']; readonly locale: string }): Promise<React.ReactElement> {
  const copy = askCopy(locale)
  const query = ((await searchParams).q ?? '').trim()
  if (query.length < 3) return <div className="p-7 text-sm leading-relaxed text-on-surface-variant">{copy.hint}</div>
  const actor = await currentActor()
  const verdict = await limit(container().rateLimiter, await callerKey(actor?.id ?? null), 'search', 'open')
  if (!verdict.allowed) return <div className="p-7 text-sm text-on-surface-variant">{copy.limited(verdict.retryAfterSeconds)}</div>
  const items = await searchReporting(query, locale)

  return <section aria-live="polite" className="p-5 md:p-7"><p className="text-xs font-bold uppercase tracking-[.15em] text-secondary-ink">{copy.prompt}</p><p className="mt-2 border-l-2 border-secondary pl-3 font-display text-2xl font-semibold">“{query}”</p>{items.length === 0 ? <div className="mt-7"><p className="font-semibold">{copy.empty}</p><p className="mt-2 text-sm text-on-surface-variant">{copy.hint}</p><Link href="/news" className="mt-5 inline-block border-b-2 border-primary pb-1 text-sm font-bold text-primary">Browse latest reporting →</Link></div> : <div className="mt-7"><p className="text-sm leading-relaxed text-on-surface-variant">{copy.answer(items.length)}</p><ol className="mt-5 space-y-3">{items.slice(0, 6).map((item, index) => <li key={item.id}><Link href={`/articles/${item.slug}`} className="group flex gap-4 border-t border-outline py-3"><span className="font-mono text-xs text-primary">{String(index + 1).padStart(2, '0')}</span><span className="font-semibold group-hover:text-primary">{item.title} <span aria-hidden>↗</span></span></Link></li>)}</ol></div>}</section>
}
