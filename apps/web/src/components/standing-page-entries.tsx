import Image from 'next/image'
import type { SitePageKey } from '@kurasikapa/domain'
import { EmptyState as EmptyStateFrame } from '@kurasikapa/ui/empty-state'
import type { SitePageEntry } from '@kurasikapa/web-kit/read-model/site-page-entries'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'

const TITLES = {
  careers: ['Open roles', 'Roles published by the newsroom appear here.'],
  faq: ['Frequently asked questions', 'Direct answers to the questions readers ask most.'],
  help: ['Help articles', 'Practical guidance for using Kurasikapa Media TV.'],
} as const

export function StandingPageEntries({ pageKey, entries }: { pageKey: SitePageKey; entries: readonly SitePageEntry[] }): React.ReactElement {
  const [title, lead] = TITLES[pageKey]
  return <section className="border-y-2 border-on-surface bg-surface-container-low">
    <div className="mx-auto max-w-[var(--container-page)] px-4 py-16 md:px-8 md:py-24">
      <header className="grid gap-5 border-b-2 border-on-surface pb-8 md:grid-cols-[1fr_22rem] md:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Live directory</p><h2 className="mt-3 font-display text-4xl font-semibold tracking-[-.04em] md:text-6xl">{title}</h2></div>
        <p className="text-lg leading-relaxed text-on-surface-variant">{lead}</p>
      </header>
      {entries.length === 0 ? <EmptyState pageKey={pageKey} /> : <EntryGrid pageKey={pageKey} entries={entries} />}
    </div>
  </section>
}

function EntryGrid({ pageKey, entries }: { pageKey: SitePageKey; entries: readonly SitePageEntry[] }): React.ReactElement {
  return <div className="border-t border-on-surface md:grid md:grid-cols-2">{entries.map((entry, index) => <article key={entry.id} className="border-b border-on-surface p-6 md:p-8 md:odd:border-r">
    <span className="font-mono text-sm text-secondary-ink">{String(index + 1).padStart(2, '0')}</span>
    <h3 className="mt-8 max-w-[20ch] font-display text-3xl font-semibold leading-tight">{entry.title}</h3>
    {entry.summary !== '' && <p className="mt-3 text-sm font-bold uppercase tracking-[.08em] text-primary">{entry.summary}</p>}
    <p className="mt-6 whitespace-pre-line leading-[1.75] text-on-surface-variant">{entry.body}</p>
    {pageKey === 'careers' && <p className="mt-7 border-t border-outline-variant pt-5 text-sm font-semibold">Apply through the newsroom contact page and name this role.</p>}
  </article>)}</div>
}

function EmptyState({ pageKey }: { pageKey: SitePageKey }): React.ReactElement {
  const copy = pageKey === 'careers'
    ? { eyebrow: 'Recruitment desk', title: 'No roles are open today.', description: 'The newsroom is not hiring for a specific position right now. You can still introduce yourself and share your strongest work.', action: 'Contact the newsroom', href: '/contact' }
    : pageKey === 'faq'
      ? { eyebrow: 'Reader questions', title: 'The question desk is being prepared.', description: 'Editors are collecting the questions readers ask most. For an answer today, the newsroom and help desk are still available.', action: 'Visit the help centre', href: '/help' }
      : { eyebrow: 'Support desk', title: 'No help guides are needed yet.', description: 'Practical guides will appear here as new reader tools launch. The newsroom can help directly in the meantime.', action: 'Contact support', href: '/contact' }

  return <EmptyStateFrame
    className="mt-8"
    eyebrow={copy.eyebrow}
    title={copy.title}
    description={copy.description}
    visual={<Image src="/brand-logo-transparent.png" alt="" width={1536} height={1024} className="h-8 w-auto object-contain" />}
    actions={<Link href={copy.href} className="bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-inverse-surface">{copy.action} <span aria-hidden>↗</span></Link>}
    compact
  />
}
