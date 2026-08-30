'use client'

import { useMemo, useState, useTransition } from 'react'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import type { SitePageKey } from '@kurasikapa/domain'
import { saveSitePageAction } from '../actions/pages'
import { MarkdownBodyField } from './editor-fields'

export interface EditableSitePage { readonly key: SitePageKey; readonly locale: string; readonly title: string; readonly lead: string; readonly body: string; readonly updatedAt: string | null }
const KEYS: readonly SitePageKey[] = ['careers', 'help', 'faq']
const EMPTY = (key: SitePageKey, locale: string): EditableSitePage => ({ key, locale, title: '', lead: '', body: '', updatedAt: null })

export function SitePageEditor({ pages }: { pages: readonly EditableSitePage[] }): React.ReactElement {
  const [key, setKey] = useState<SitePageKey>('careers')
  const [locale, setLocale] = useState('en')
  const initial = useMemo(() => pages.find((page) => page.key === key && page.locale === locale) ?? EMPTY(key, locale), [key, locale, pages])
  return <div className="grid gap-7 lg:grid-cols-[18rem_minmax(0,1fr)]"><PagePicker active={key} locale={locale} onKey={setKey} onLocale={setLocale} /><Editor key={`${key}:${locale}:${initial.updatedAt ?? 'new'}`} initial={initial} /></div>
}

function PagePicker({ active, locale, onKey, onLocale }: { active: SitePageKey; locale: string; onKey: (key: SitePageKey) => void; onLocale: (locale: string) => void }): React.ReactElement {
  return <aside className="h-fit border-t-4 border-secondary bg-inverse-surface p-4 text-white lg:sticky lg:top-5"><div className="mb-5 flex gap-2">{['en', 'fr'].map((value) => <button key={value} type="button" onClick={() => { onLocale(value) }} className={`flex-1 border px-3 py-2 text-xs font-bold uppercase ${locale === value ? 'border-secondary bg-secondary text-on-secondary' : 'border-white/20'}`}>{value}</button>)}</div><nav aria-label="Editable pages"><ul className="space-y-1">{KEYS.map((value) => <li key={value}><button type="button" onClick={() => { onKey(value) }} className={`w-full border-l-4 px-3 py-3 text-left text-sm font-semibold capitalize ${active === value ? 'border-secondary bg-white/10 text-white' : 'border-transparent text-white/55 hover:text-white'}`}>{value}</button></li>)}</ul></nav></aside>
}

function Editor({ initial }: { initial: EditableSitePage }): React.ReactElement {
  const [title, setTitle] = useState(initial.title)
  const [lead, setLead] = useState(initial.lead)
  const [body, setBody] = useState(initial.body)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const save = (): void => { setMessage(null); startTransition(async () => { const result = await callAction(() => saveSitePageAction({ key: initial.key, locale: initial.locale, title, lead, body })); setMessage(result.ok ? 'Published to the public page.' : result.error.message) }) }
  return <section className="border border-outline-variant bg-surface-container-lowest"><header className="border-b border-outline-variant p-5"><p className="broadcast-kicker text-primary">{initial.locale} · {initial.key}</p><h2 className="mt-2 font-display text-2xl font-semibold text-on-surface">Page content</h2><p className="mt-2 text-sm text-on-surface-variant">Format content visually, inspect Markdown source, or switch to a clean reader preview.</p></header><div className="space-y-5 p-5 md:p-7"><Field label="Page title"><input value={title} onChange={(event) => { setTitle(event.target.value) }} className="h-12 w-full border border-outline-variant bg-surface px-4 text-on-surface outline-none focus:border-primary" /></Field><Field label="Standfirst"><textarea value={lead} onChange={(event) => { setLead(event.target.value) }} rows={3} className="w-full border border-outline-variant bg-surface p-4 text-on-surface outline-none focus:border-primary" /></Field><MarkdownBodyField body={body} editable onBody={setBody} /><div className="flex flex-wrap items-center gap-4"><button type="button" disabled={pending || title.trim() === '' || body.trim() === ''} onClick={save} className="bg-primary px-6 py-3 text-sm font-bold uppercase text-on-primary disabled:opacity-40">{pending ? 'Publishing…' : 'Publish page'}</button>{message && <p role="status" className="text-sm text-on-surface-variant">{message}</p>}</div></div></section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</span>{children}</label> }
