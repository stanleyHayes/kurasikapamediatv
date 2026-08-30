import Link from 'next/link'
import type { StandingPage } from '../content/pages'
import { MarkdownView } from '../content/markdown-view'
import { StandingPageFeatures } from './standing-page-features'

type PageKey = 'about' | 'team' | 'contact' | 'careers' | 'help' | 'faq' | 'advertise' | 'privacy' | 'terms' | 'cookies'
const META: Record<PageKey, { number: string; desk: string; statement: string; accent: string }> = {
  about: { number: '01', desk: 'The organisation', statement: 'Journalism should leave people better informed than it found them.', accent: 'bg-primary' },
  team: { number: '02', desk: 'The people', statement: 'A newsroom is a promise made by people, not a logo.', accent: 'bg-secondary' },
  contact: { number: '03', desk: 'Open newsroom', statement: 'Tips, corrections and questions belong in the conversation.', accent: 'bg-primary' },
  careers: { number: '04', desk: 'Work with us', statement: 'Bring your judgement, curiosity and care for the record.', accent: 'bg-secondary' },
  help: { number: '05', desk: 'Reader support', statement: 'Clear routes to the answer you need.', accent: 'bg-primary' },
  faq: { number: '06', desk: 'Straight answers', statement: 'How the newsroom works, in plain language.', accent: 'bg-secondary' },
  advertise: { number: '07', desk: 'Partnerships', statement: 'Reach people without getting in the way of their trust.', accent: 'bg-primary' },
  privacy: { number: '08', desk: 'Reader rights', statement: 'Your data is not the price of reading the news.', accent: 'bg-secondary' },
  terms: { number: '09', desk: 'The agreement', statement: 'The simple rules that keep this public space useful.', accent: 'bg-primary' },
  cookies: { number: '10', desk: 'Data choices', statement: 'Only what the service needs, and choices you can understand.', accent: 'bg-secondary' },
}

export function StandingPageView({ page, pageKey, locale, children }: { page: StandingPage; pageKey: PageKey; locale: string; children?: React.ReactNode }): React.ReactElement {
  return <article className="overflow-hidden bg-surface text-on-surface">
    <DossierHero page={page} meta={META[pageKey]} />
    {page.body === undefined ? <StaticSections page={page} pageKey={pageKey} /> : <ManagedBody page={page} pageKey={pageKey} />}
    <StandingPageFeatures pageKey={pageKey} locale={locale} />
    {children}
    <PageClose pageKey={pageKey} locale={locale} />
  </article>
}

function DossierHero({ page, meta }: { page: StandingPage; meta: (typeof META)[PageKey] }): React.ReactElement {
  return <header className="paper-noise relative border-b-2 border-on-surface">
    <div className="mx-auto grid max-w-[var(--container-page)] px-4 md:grid-cols-[9rem_minmax(0,1fr)] md:px-8">
      <div className="hidden border-x border-on-surface/25 py-10 md:flex md:flex-col md:justify-between md:px-5">
        <span className="font-display text-6xl font-semibold leading-none text-primary">{meta.number}</span>
        <span className="origin-bottom-left -rotate-90 whitespace-nowrap text-[.65rem] font-bold uppercase tracking-[.28em] text-on-surface-variant">Public file / 2026</span>
      </div>
      <div className="relative min-h-[34rem] px-1 py-12 md:px-12 md:py-20 lg:py-24">
        <div aria-hidden className={`absolute right-0 top-0 h-3 w-[42%] ${meta.accent}`} />
        <p className="mb-12 flex items-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-primary-ink"><span className={`h-2 w-2 ${meta.accent}`} />{meta.desk}</p>
        <h1 className="max-w-[12ch] font-display text-[clamp(3.5rem,8vw,7.8rem)] font-semibold leading-[.82] tracking-[-.07em]">{page.title}</h1>
        <div className="mt-12 grid gap-8 border-t border-on-surface pt-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <p className="max-w-[52ch] text-xl font-medium leading-snug md:text-2xl">{page.lead ?? page.sections[0]?.paragraphs[0]}</p>
          <p className="font-display text-2xl leading-tight text-primary">{meta.statement}</p>
        </div>
      </div>
    </div>
  </header>
}

function StaticSections({ page, pageKey }: { page: StandingPage; pageKey: PageKey }): React.ReactElement {
  return <div className="mx-auto max-w-[var(--container-page)] px-4 py-16 md:px-8 md:py-24"><div className="grid gap-12 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <PageIndex page={page} pageKey={pageKey} />
    <div className="border-t-2 border-on-surface">{page.sections.map((section, index) => <section key={section.heading ?? `section-${String(index)}`} className="grid gap-5 border-b border-outline-variant py-10 md:grid-cols-[4rem_minmax(0,1fr)] md:py-14">
      <span className="font-display text-2xl font-semibold text-secondary-ink">{String(index + 1).padStart(2, '0')}</span>
      <div>
        {section.heading !== undefined && <h2 className="max-w-[18ch] font-display text-4xl font-semibold leading-[.95] tracking-[-.045em] md:text-5xl">{section.heading}</h2>}
        <div className={section.heading === undefined ? '' : 'mt-7'}>{section.paragraphs.map((text) => <p key={text.slice(0, 44)} className="mb-5 max-w-[64ch] text-lg leading-[1.75] text-on-surface-variant last:mb-0">{text}</p>)}</div>
        {section.bullets !== undefined && <dl className="mt-9 grid border-t border-on-surface sm:grid-cols-2">{section.bullets.map((bullet, itemIndex) => <div key={bullet.term} className={`border-b border-on-surface py-6 sm:px-6 ${itemIndex % 2 === 0 ? 'sm:border-r' : ''}`}><dt className="font-display text-2xl font-semibold">{bullet.term}</dt><dd className="mt-2 max-w-[34ch] leading-relaxed text-on-surface-variant">{bullet.detail}</dd></div>)}</dl>}
      </div>
    </section>)}</div>
  </div></div>
}

function ManagedBody({ page, pageKey }: { page: StandingPage; pageKey: PageKey }): React.ReactElement {
  return <div className="mx-auto grid max-w-[var(--container-page)] gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <PageIndex page={page} pageKey={pageKey} />
    <div className="border-t-2 border-on-surface pt-10"><MarkdownView source={page.body ?? ''} /></div>
  </div>
}

function PageIndex({ page, pageKey }: { page: StandingPage; pageKey: PageKey }): React.ReactElement {
  const headings = page.sections.flatMap((section) => section.heading === undefined ? [] : [section.heading])
  return <aside className="h-fit lg:sticky lg:top-28"><p className="text-xs font-bold uppercase tracking-[.18em] text-on-surface-variant">In this file</p><div className="mt-4 h-1 w-12 bg-secondary" />
    {headings.length > 0 && <ol className="mt-7 space-y-4">{headings.map((heading, index) => <li key={heading} className="grid grid-cols-[2rem_1fr] text-sm"><span className="font-mono text-primary">{String(index + 1).padStart(2, '0')}</span><span className="font-semibold">{heading}</span></li>)}</ol>}
    <p className="mt-8 border-t border-outline-variant pt-5 text-sm leading-relaxed text-on-surface-variant">{supportCopy(pageKey)}</p>
  </aside>
}

function PageClose({ pageKey, locale }: { pageKey: PageKey; locale: string }): React.ReactElement {
  const policy = ['privacy', 'terms', 'cookies'].includes(pageKey)
  return <footer className="border-y-2 border-on-surface bg-inverse-surface text-white"><div className="mx-auto grid max-w-[var(--container-page)] gap-7 px-6 py-10 md:grid-cols-[1fr_auto] md:items-end md:px-8 md:py-14">
    <div><p className="text-xs font-bold uppercase tracking-[.2em] text-secondary">{policy ? 'Last reviewed · 30 August 2026' : 'Kurasikapa Media TV'}</p><p className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight md:text-4xl">{policy ? 'Questions about your rights deserve a human answer.' : 'There is always a route back to the newsroom.'}</p></div>
    <Link href={`/${locale}/contact`} className="inline-flex border-b-2 border-secondary pb-2 text-sm font-bold text-secondary transition-colors hover:text-white">Contact the newsroom ↗</Link>
  </div></footer>
}

function supportCopy(key: PageKey): string {
  if (['privacy', 'terms', 'cookies'].includes(key)) return 'This document explains our commitments in plain language. Contact us if anything is unclear.'
  if (['help', 'faq', 'contact'].includes(key)) return 'Reader support is handled by people. Include enough detail for us to investigate properly.'
  return 'This page is part of the public record of who we are and how we work.'
}
