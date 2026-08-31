'use client'

import { useMemo, useState, useTransition } from 'react'
import type { SitePageKey } from '@kurasikapa/domain'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import type { SitePageEntry } from '@kurasikapa/web-kit/read-model/site-page-entries'
import { saveSitePageEntriesAction } from '../actions/pages'

export interface EditableSitePage {
  readonly key: SitePageKey
  readonly locale: string
  readonly entries: readonly SitePageEntry[]
}

const KEYS: readonly SitePageKey[] = ['careers', 'help', 'faq']
const LABELS = { careers: 'Open roles', help: 'Help articles', faq: 'FAQ answers' } as const

export function SitePageEditor({ pages }: { pages: readonly EditableSitePage[] }): React.ReactElement {
  const [key, setKey] = useState<SitePageKey>('careers')
  const [locale, setLocale] = useState('en')
  const [collections, setCollections] = useState(pages)
  const entries = useMemo(
    () => collections.find((page) => page.key === key && page.locale === locale)?.entries ?? [],
    [collections, key, locale],
  )
  const update = (next: readonly SitePageEntry[]): void => {
    setCollections((current) => [
      ...current.filter((page) => page.key !== key || page.locale !== locale),
      { key, locale, entries: next },
    ])
  }
  return <div className="grid gap-7 lg:grid-cols-[18rem_minmax(0,1fr)]"><PagePicker active={key} locale={locale} onKey={setKey} onLocale={setLocale} /><EntryWorkspace key={`${key}:${locale}`} pageKey={key} locale={locale} entries={entries} onPublished={update} /></div>
}

function PagePicker(props: { active: SitePageKey; locale: string; onKey: (key: SitePageKey) => void; onLocale: (locale: string) => void }): React.ReactElement {
  return <aside className="h-fit border-t-4 border-secondary bg-inverse-surface p-4 text-white lg:sticky lg:top-5"><div className="mb-5 flex gap-2">{['en', 'fr'].map((value) => <button key={value} type="button" onClick={() => { props.onLocale(value) }} className={`flex-1 border px-3 py-2 text-xs font-bold uppercase ${props.locale === value ? 'border-secondary bg-secondary text-on-secondary' : 'border-white/20'}`}>{value}</button>)}</div><nav aria-label="Managed public content"><ul className="space-y-1">{KEYS.map((value) => <li key={value}><button type="button" onClick={() => { props.onKey(value) }} className={`w-full border-l-4 px-3 py-3 text-left text-sm font-semibold ${props.active === value ? 'border-secondary bg-white/10 text-white' : 'border-transparent text-white/55 hover:text-white'}`}>{LABELS[value]}</button></li>)}</ul></nav></aside>
}

function EntryWorkspace(props: { pageKey: SitePageKey; locale: string; entries: readonly SitePageEntry[]; onPublished: (entries: readonly SitePageEntry[]) => void }): React.ReactElement {
  const [editing, setEditing] = useState<SitePageEntry | null>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const publish = (next: readonly SitePageEntry[], success: string): void => {
    setMessage(null)
    startTransition(async () => {
      const result = await callAction(() => saveSitePageEntriesAction({ key: props.pageKey, locale: props.locale, entries: next }))
      if (!result.ok) { setMessage(result.error.message); return }
      props.onPublished(result.data.entries)
      setEditing(null)
      setMessage(success)
    })
  }
  const saveEntry = (entry: SitePageEntry): void => {
    publish([...props.entries.filter((item) => item.id !== entry.id), entry], 'Entry published to the public page.')
  }
  return <section className="space-y-6"><CollectionHeader pageKey={props.pageKey} locale={props.locale} count={props.entries.length} onCreate={() => { setEditing({ id: '', title: '', summary: '', body: '' }) }} /><div className="border-l-4 border-secondary bg-secondary-container/35 px-5 py-4 text-sm leading-relaxed text-on-surface-variant"><strong className="text-on-surface">The page introduction and guidance stay fixed.</strong> Only these records are managed here and rendered dynamically.</div>{editing !== null && <EntryForm pageKey={props.pageKey} entry={editing} pending={pending} onCancel={() => { setEditing(null) }} onPublish={saveEntry} />}{props.entries.length === 0 ? <EmptyCollection pageKey={props.pageKey} /> : <EntryList entries={props.entries} pending={pending} onEdit={setEditing} onRemove={(id) => { publish(props.entries.filter((entry) => entry.id !== id), 'Entry removed from the public page.') }} />}{message !== null && <p role="status" className="border-l-4 border-primary bg-primary-container px-4 py-3 text-sm text-on-surface">{message}</p>}</section>
}

function CollectionHeader(props: { pageKey: SitePageKey; locale: string; count: number; onCreate: () => void }): React.ReactElement {
  return <header className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-on-surface pb-5"><div><p className="broadcast-kicker text-primary">{props.locale} · {props.pageKey}</p><h2 className="mt-2 font-display text-3xl font-semibold text-on-surface">{LABELS[props.pageKey]}</h2><p className="mt-2 text-sm text-on-surface-variant">{props.count} {props.count === 1 ? 'published entry' : 'published entries'}</p></div><button type="button" onClick={props.onCreate} className="bg-primary px-5 py-3 text-sm font-bold text-on-primary hover:bg-inverse-surface">Add {singular(props.pageKey)}</button></header>
}

function EntryForm(props: { pageKey: SitePageKey; entry: SitePageEntry; pending: boolean; onCancel: () => void; onPublish: (entry: SitePageEntry) => void }): React.ReactElement {
  const [title, setTitle] = useState(props.entry.title)
  const [summary, setSummary] = useState(props.entry.summary)
  const [body, setBody] = useState(props.entry.body)
  const valid = title.trim() !== '' && body.trim() !== ''
  const submit = (event: React.SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (valid) props.onPublish({ ...props.entry, title: title.trim(), summary: summary.trim(), body: body.trim() })
  }
  return <form onSubmit={submit} className="border border-outline-variant bg-surface-container-lowest"><header className="border-b border-outline-variant px-5 py-4"><h3 className="font-display text-xl font-semibold">{props.entry.title === '' ? `New ${singular(props.pageKey)}` : `Edit ${singular(props.pageKey)}`}</h3></header><div className="space-y-5 p-5 md:p-7"><Field label={props.pageKey === 'faq' ? 'Question' : 'Title'}><input value={title} onChange={(event) => { setTitle(event.target.value) }} placeholder={titlePlaceholder(props.pageKey)} className="h-12 w-full px-4" /></Field><Field label={props.pageKey === 'careers' ? 'Location and employment type' : 'Short summary'}><input value={summary} onChange={(event) => { setSummary(event.target.value) }} placeholder={summaryPlaceholder(props.pageKey)} className="h-12 w-full px-4" /></Field><Field label={props.pageKey === 'faq' ? 'Answer' : 'Details'}><textarea value={body} onChange={(event) => { setBody(event.target.value) }} rows={7} placeholder={bodyPlaceholder(props.pageKey)} className="w-full p-4" /></Field><div className="flex gap-3"><button type="submit" disabled={props.pending || !valid} className="bg-primary px-6 py-3 text-sm font-bold text-on-primary disabled:opacity-40">{props.pending ? 'Publishing…' : 'Publish entry'}</button><button type="button" disabled={props.pending} onClick={props.onCancel} className="border border-on-surface px-5 py-3 text-sm font-bold">Cancel</button></div></div></form>
}

function EntryList(props: { entries: readonly SitePageEntry[]; pending: boolean; onEdit: (entry: SitePageEntry) => void; onRemove: (id: string) => void }): React.ReactElement {
  return <div className="border-t-2 border-on-surface">{props.entries.map((entry, index) => <article key={entry.id} className="grid gap-5 border-b border-outline-variant bg-surface-container-lowest p-5 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:p-6"><span className="font-mono text-sm text-secondary-ink">{String(index + 1).padStart(2, '0')}</span><div><h3 className="font-display text-xl font-semibold">{entry.title}</h3>{entry.summary !== '' && <p className="mt-1 text-sm font-semibold text-primary">{entry.summary}</p>}<p className="mt-3 line-clamp-2 text-sm leading-relaxed text-on-surface-variant">{entry.body}</p></div><div className="flex items-start gap-2"><button type="button" disabled={props.pending} onClick={() => { props.onEdit(entry) }} className="border border-on-surface px-3 py-2 text-xs font-bold">Edit</button><button type="button" disabled={props.pending} onClick={() => { props.onRemove(entry.id) }} className="border border-error px-3 py-2 text-xs font-bold text-error">Remove</button></div></article>)}</div>
}

function EmptyCollection({ pageKey }: { pageKey: SitePageKey }): React.ReactElement { return <div className="border-y border-outline-variant bg-surface-container-lowest px-6 py-12 text-center"><p className="font-display text-2xl font-semibold">No {LABELS[pageKey].toLowerCase()} published.</p><p className="mt-2 text-sm text-on-surface-variant">The static page remains complete while this collection is empty.</p></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.1em] text-on-surface-variant">{label}</span>{children}</label> }
function singular(key: SitePageKey): string { return key === 'careers' ? 'role' : key === 'faq' ? 'question' : 'help article' }
function titlePlaceholder(key: SitePageKey): string { return key === 'careers' ? 'Senior news producer' : key === 'faq' ? 'How do I update my email address?' : 'Manage your saved stories' }
function summaryPlaceholder(key: SitePageKey): string { return key === 'careers' ? 'Accra · Full time · Hybrid' : 'One sentence to help readers find the right answer.' }
function bodyPlaceholder(key: SitePageKey): string { return key === 'faq' ? 'Write a direct, complete answer.' : key === 'careers' ? 'Describe the role, responsibilities and how to apply.' : 'Give the reader clear steps and any relevant contact route.' }
