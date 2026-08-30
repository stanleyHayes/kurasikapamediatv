import type { StandingPage } from '../content/pages'
import { MarkdownView } from '../content/markdown-view'

/**
 * The full-bleed opening from the About and Team designs: a centred display
 * headline over a single line of standfirst.
 *
 * The design fills the background with a photograph of a studio. There is no
 * media library until R3, so the panel uses the design system's solid fields;
 * the composition, type scale and centring all hold, and one
 * element changes when images land.
 */
function PageHero({ page }: { page: StandingPage }): React.ReactElement {
  return (
    <header className="reveal paper-noise relative mb-[var(--space-lg)] grid min-h-[360px] overflow-hidden border-y-2 border-on-surface bg-surface-container-lowest md:min-h-[500px] md:grid-cols-[1fr_12rem]">
      <div
        aria-hidden
        className="bg-secondary absolute bottom-0 left-0 h-4 w-2/3"
      />
      <div className="relative flex flex-col justify-end px-7 py-12 md:px-14 md:py-16">
        <p className="broadcast-kicker mb-5 text-primary-ink">Kurasikapa Media TV</p>
        <h1 className="font-display max-w-4xl text-[2.75rem] leading-none font-bold tracking-[-0.04em] text-on-surface md:text-[length:var(--text-display-lg)]">
          {page.title}
        </h1>

        {page.lead !== undefined && (
          <p className="mt-6 max-w-2xl text-[length:var(--text-body-lg)] text-on-surface-variant">
            {page.lead}
          </p>
        )}
      </div>
      <div aria-hidden className="signal-grid hidden border-l-2 border-on-surface bg-primary md:flex md:items-center md:justify-center"><span className="-rotate-90 whitespace-nowrap text-sm font-bold tracking-[0.35em] text-white/70 uppercase">Kurasikapa Media TV</span></div>
    </header>
  )
}

/**
 * One renderer for every standing page.
 *
 * Regal Precision: expansive vertical rhythm, Outfit for the title and body
 * at body-lg for prose, and a measure capped near 65 characters — long lines
 * are the fastest way to make an editorial site tiring to read.
 */
export function StandingPageView({ page, pageKey }: { page: StandingPage; pageKey?: string }): React.ReactElement {
  return (
    <article className="mx-auto max-w-[var(--container-page)] px-4 py-[var(--space-xl)] md:px-8">
      <PageHero page={page} />

      {page.needsClientCopy === true && <ProvisionalNotice />}

      {page.body !== undefined ? <CmsBody body={page.body} {...(pageKey === undefined ? {} : { pageKey })} /> : <div className="mt-[var(--space-lg)] grid gap-6 md:grid-cols-12 md:gap-8">
        {page.sections.map((section, i) => (
          <section key={section.heading ?? `s${String(i)}`} className={`reveal ${sectionClass(i, section.bullets !== undefined)}`}>
            {section.heading !== undefined && (
              <h2 className="font-display text-on-surface text-[length:var(--text-headline-sm)] font-semibold tracking-[-0.025em]">
                {section.heading}
              </h2>
            )}

            {section.paragraphs.map((text) => (
              <p
                key={text.slice(0, 40)}
                className="text-on-surface mt-[var(--space-sm)] max-w-[65ch] text-[length:var(--text-body-lg)] leading-relaxed"
              >
                {text}
              </p>
            ))}

            {section.bullets !== undefined && (
              <dl className="mt-[var(--space-sm)] flex flex-col gap-3">
                {section.bullets.map((bullet) => (
                  <div key={bullet.term} className="border-outline-variant border-l-2 pl-4">
                    <dt className="text-label-bold text-secondary-ink uppercase">{bullet.term}</dt>
                    <dd className="text-on-surface mt-1">{bullet.detail}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}
      </div>}
    </article>
  )
}

function CmsBody({ body, pageKey }: { body: string; pageKey?: string }): React.ReactElement {
  return <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="border-t-4 border-primary bg-white p-6 md:p-10"><MarkdownView source={body} /></div>
    <aside className="signal-grid h-fit border-t-4 border-secondary bg-inverse-surface p-6 text-white lg:sticky lg:top-28"><p className="broadcast-kicker text-secondary">Public information</p><p className="mt-5 font-display text-2xl font-semibold">Clear. Accountable. Accessible.</p><p className="mt-4 text-sm leading-relaxed text-white/65">This page is maintained by the Kurasikapa newsroom through the publishing studio.</p>{pageKey !== 'contact' && <a href="/en/contact" className="mt-7 inline-flex border border-secondary px-4 py-3 text-xs font-bold uppercase text-secondary">Ask the newsroom ↗</a>}</aside>
  </div>
}

function sectionClass(index: number, hasBullets: boolean): string {
  if (index === 0) return 'md:col-span-8 md:pb-8'
  if (hasBullets) return 'bg-white border-t-4 border-primary p-6 md:col-span-12 md:p-10'
  return index % 2 === 0
    ? 'bg-primary-container/45 border-l-4 border-primary p-6 md:col-span-6 md:p-9'
    : 'bg-white border-t border-outline-variant p-6 md:col-span-6 md:p-9'
}

/**
 * Visible to readers on purpose.
 *
 * A legal page carrying placeholder wording without saying so is worse than
 * one that admits it — a reader relying on it deserves to know, and it keeps
 * the client's outstanding item in front of everyone rather than in a ticket.
 */
function ProvisionalNotice(): React.ReactElement {
  return (
    <p
      role="note"
      className="border-secondary bg-secondary-container text-on-secondary-container mt-[var(--space-md)] max-w-2xl border-l-2 py-3 pl-4 text-sm"
    >
      This page is provisional and awaiting the organisation&rsquo;s own wording.
    </p>
  )
}
