import type { StandingPage } from '../content/pages'

/**
 * The full-bleed opening from the About and Team designs: a centred display
 * headline over a single line of standfirst.
 *
 * The design fills the background with a photograph of a studio. There is no
 * media library until R3, so the panel is the design system's own tonal
 * gradient — the composition, type scale and centring all hold, and one
 * element changes when images land.
 */
function PageHero({ page }: { page: StandingPage }): React.ReactElement {
  return (
    <header className="relative mb-[var(--spacing-lg)] flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-xl px-6 py-16 text-center md:min-h-[420px]">
      <div
        aria-hidden
        className="from-surface-container-high via-surface-container to-surface absolute inset-0 bg-gradient-to-b"
      />

      <div className="relative">
        <h1 className="font-display text-on-surface mx-auto max-w-4xl text-[2.5rem] leading-[1.15] font-bold tracking-[-0.02em] md:text-[length:var(--text-display-lg)] md:leading-[1.1]">
          {page.title}
        </h1>

        {page.lead !== undefined && (
          <p className="text-on-surface-variant mx-auto mt-6 max-w-2xl text-[length:var(--text-body-lg)]">
            {page.lead}
          </p>
        )}
      </div>
    </header>
  )
}

/** The ordinary heading, for pages whose design does not call for a hero. */
function PageHeading({ page }: { page: StandingPage }): React.ReactElement {
  return (
    <>
      <h1 className="font-display text-primary max-w-3xl text-[length:var(--text-headline-md)] leading-tight font-semibold">
        {page.title}
      </h1>

      {page.lead !== undefined && (
        <p className="text-on-surface-variant mt-[var(--spacing-sm)] max-w-2xl text-[length:var(--text-body-lg)]">
          {page.lead}
        </p>
      )}
    </>
  )
}

/**
 * One renderer for every standing page.
 *
 * Regal Precision: expansive vertical rhythm, Playfair for the title, Outfit
 * at body-lg for prose, and a measure capped near 65 characters — long lines
 * are the fastest way to make an editorial site tiring to read.
 */
export function StandingPageView({ page }: { page: StandingPage }): React.ReactElement {
  return (
    <article className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-xl)]">
      {page.hero === true ? <PageHero page={page} /> : <PageHeading page={page} />}

      {page.needsClientCopy === true && <ProvisionalNotice />}

      <div className="mt-[var(--spacing-lg)] flex flex-col gap-[var(--spacing-lg)]">
        {page.sections.map((section, i) => (
          <section key={section.heading ?? `s${String(i)}`} className="max-w-[65ch]">
            {section.heading !== undefined && (
              <h2 className="font-display text-on-surface text-[length:var(--text-headline-sm)] font-semibold">
                {section.heading}
              </h2>
            )}

            {section.paragraphs.map((text) => (
              <p
                key={text.slice(0, 40)}
                className="text-on-surface mt-[var(--spacing-sm)] text-[length:var(--text-body-lg)] leading-relaxed"
              >
                {text}
              </p>
            ))}

            {section.bullets !== undefined && (
              <dl className="mt-[var(--spacing-sm)] flex flex-col gap-3">
                {section.bullets.map((bullet) => (
                  <div key={bullet.term} className="border-outline-variant border-l-2 pl-4">
                    <dt className="text-label-bold text-secondary uppercase">{bullet.term}</dt>
                    <dd className="text-on-surface mt-1">{bullet.detail}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        ))}
      </div>
    </article>
  )
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
      className="border-secondary bg-secondary-container text-on-secondary-container mt-[var(--spacing-md)] max-w-2xl border-l-2 py-3 pl-4 text-sm"
    >
      This page is provisional and awaiting the organisation&rsquo;s own wording.
    </p>
  )
}
