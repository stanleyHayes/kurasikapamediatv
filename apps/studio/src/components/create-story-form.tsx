'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from '@kurasikapa/web-kit/i18n/navigation'
import { callAction } from '@kurasikapa/web-kit/actions/call'
import { createDraftAction } from '../actions/editorial'

interface CategoryOption { readonly id: string; readonly locale: string; readonly name: string }

export function CreateStoryForm({ categories, initialLocale }: { categories: readonly CategoryOption[]; initialLocale: string }): React.ReactElement {
  const router = useRouter()
  const [locale, setLocale] = useState(initialLocale)
  const available = useMemo(() => categories.filter((item) => item.locale === locale), [categories, locale])
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const submit = (form: FormData): void => {
    setError(null)
    startTransition(async () => {
      const result = await callAction(() => createDraftAction({ locale, title: text(form, 'title'), body: text(form, 'body'), categoryId: text(form, 'categoryId') }))
      if (!result.ok) { setError(result.error.message); return }
      router.push(`/articles/${result.data.id}`)
    })
  }
  return <form action={submit} className="border border-outline-variant bg-surface-container-lowest"><header className="border-b border-outline-variant px-5 py-5 md:px-7"><p className="broadcast-kicker text-primary">Original reporting</p><h2 className="mt-2 font-display text-2xl font-semibold">Start with the essential facts</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">This creates a private draft and opens the full editor. Nothing reaches readers until it passes review and an authorised editor publishes it.</p></header><div className="space-y-6 p-5 md:p-7"><fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-[.12em] text-on-surface-variant">Story language</legend><div className="flex w-fit border border-outline">{['en', 'fr'].map((value) => <button key={value} type="button" onClick={() => { setLocale(value) }} aria-pressed={locale === value} className={`px-5 py-3 text-xs font-bold uppercase ${locale === value ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface'}`}>{value === 'en' ? 'English' : 'French'}</button>)}</div></fieldset><Field label="Headline"><input name="title" required maxLength={300} placeholder="Write a clear, specific working headline" className="h-14 w-full px-4 text-lg" /></Field><Field label="Section"><select key={locale} name="categoryId" required defaultValue="" className="h-14 w-full px-4"><option value="" disabled>Choose the section readers will find this under</option>{available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Opening notes or first draft"><textarea name="body" rows={10} placeholder="Begin the report, paste verified notes, or outline the essential facts. You can continue writing in the full editor." className="w-full p-4 leading-7" /></Field>{available.length === 0 && <p role="alert" className="border-l-4 border-error bg-error-container px-4 py-3 text-sm text-on-error-container">No sections are configured for this language. Add a translated section before creating the story.</p>}{error !== null && <p role="alert" className="text-sm text-error">{error}</p>}<div className="flex flex-wrap items-center gap-4"><button type="submit" disabled={pending || available.length === 0} className="bg-primary px-6 py-3.5 text-sm font-bold text-on-primary disabled:opacity-45">{pending ? 'Creating draft…' : 'Create draft and open editor'}</button><p className="text-xs text-on-surface-variant">Saved privately first · Review required · Publication is separate</p></div></div></form>
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-on-surface-variant">{label}</span>{children}</label> }
function text(form: FormData, name: string): string { const value = form.get(name); return typeof value === 'string' ? value : '' }
