import Link from 'next/link'

type PageKey = 'about' | 'team' | 'contact' | 'careers' | 'help' | 'faq' | 'advertise' | 'privacy' | 'terms' | 'cookies'
interface Feature { readonly title: string; readonly copy: string }

const FEATURES: Partial<Record<PageKey, readonly Feature[]>> = {
  team: [
    { title: 'Editorial direction', copy: 'Sets standards, challenges assumptions and protects the independence of every story.' },
    { title: 'Reporting', copy: 'Finds the people, documents and lived experience that turn an event into a useful account.' },
    { title: 'Production', copy: 'Shapes field reporting into clear television, audio and digital journalism.' },
    { title: 'Audience', copy: 'Listens to readers, handles corrections and keeps the newsroom connected to its communities.' },
  ],
  contact: [
    { title: 'News tips', copy: 'Share a lead, document or first-hand account. Tell us how we may contact you safely.' },
    { title: 'Corrections', copy: 'Point us to the story and the exact claim. We investigate and correct the public record openly.' },
    { title: 'Press & partnerships', copy: 'For interviews, programme enquiries and institutional correspondence.' },
  ],
  careers: [
    { title: '01 · Show your work', copy: 'Send examples that reveal how you think, report, edit, produce or build.' },
    { title: '02 · Meet the newsroom', copy: 'A practical conversation about standards, judgement and the work ahead.' },
    { title: '03 · Make something', copy: 'Shortlisted candidates complete a role-relevant exercise with a clear brief.' },
  ],
  help: [
    { title: 'Your account', copy: 'Sign-in, password, saved stories, language, theme and security settings.' },
    { title: 'Reading & access', copy: 'Navigation, newsletters, accessibility and finding a published story.' },
    { title: 'Editorial questions', copy: 'Sources, corrections, comments, translations and how we use assisted tools.' },
  ],
  faq: [
    { title: 'Editorial standards', copy: 'How stories are reported, reviewed, corrected and translated.' },
    { title: 'Reader services', copy: 'Answers about accounts, newsletters, comments and saved stories.' },
    { title: 'Working together', copy: 'Careers, advertising, syndication and newsroom contact routes.' },
  ],
  advertise: [
    { title: 'Clear labelling', copy: 'Commercial work is identified plainly. Readers should always know who paid for a message.' },
    { title: 'Editorial distance', copy: 'A partnership never buys influence over our newsroom or independent coverage.' },
    { title: 'Useful placement', copy: 'Formats are designed around reader attention, accessibility and the natural rhythm of the page.' },
  ],
  privacy: [
    { title: 'Collect less', copy: 'We limit collection to information needed to operate, secure and improve the service.' },
    { title: 'Explain why', copy: 'Every category of data should have a clear purpose and a lawful basis.' },
    { title: 'Respect control', copy: 'You may ask to access, correct or erase personal data, subject to applicable law.' },
  ],
  terms: [
    { title: 'Read and share', copy: 'Link to our work and quote reasonable extracts with clear attribution.' },
    { title: 'Do not republish', copy: 'Full reproduction, scraping for resale and removal of attribution require permission.' },
    { title: 'Use good judgement', copy: 'Our reporting informs public understanding; it is not individual legal, medical or financial advice.' },
  ],
}

export function StandingPageFeatures({ pageKey, locale }: { pageKey: PageKey; locale: string }): React.ReactElement | null {
  const items = FEATURES[pageKey]
  if (items === undefined) return null
  return <section className="border-t-2 border-on-surface bg-primary-container/25">
    <div className="mx-auto max-w-[var(--container-page)] px-4 py-16 md:px-8 md:py-24">
      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">At a glance</p><h2 className="mt-5 font-display text-4xl font-semibold leading-[.95] tracking-[-.045em]">What matters here</h2></div>
        <ol className="border-t-2 border-on-surface">{items.map((item, index) => <li key={item.title} className="group grid gap-3 border-b border-on-surface py-7 md:grid-cols-[3rem_15rem_1fr] md:items-start">
          <span className="font-mono text-sm text-secondary-ink">{String(index + 1).padStart(2, '0')}</span><h3 className="font-display text-2xl font-semibold transition-colors group-hover:text-primary">{item.title}</h3><p className="max-w-[48ch] leading-relaxed text-on-surface-variant">{item.copy}</p>
        </li>)}</ol>
      </div>
      {['help', 'faq'].includes(pageKey) && <div className="mt-12 flex justify-end"><Link href={`/${locale}/contact`} className="border-b-2 border-primary pb-2 text-sm font-bold text-primary">Still need help? Write to us ↗</Link></div>}
    </div>
  </section>
}
