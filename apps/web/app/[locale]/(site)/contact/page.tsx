import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { ContactForm } from '@/components/contact/contact-form'
import { StandingPageView } from '@/components/standing-page'
import { pageFor } from '@/content/pages'
import { type StandingParams, staticStandingRoute } from '@/content/standing-route'

const route = staticStandingRoute('contact', 'contact')

export const generateMetadata = route.generateMetadata

export default function ContactPage({ params }: StandingParams): React.ReactElement {
  return (
    <Suspense fallback={<p className="text-on-surface-variant px-6 py-8">Loading…</p>}>
      <Body params={params} />
    </Suspense>
  )
}

async function Body({ params }: StandingParams): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <StandingPageView page={pageFor('contact', locale)} pageKey="contact" locale={locale}>
      <section className="border-t-2 border-on-surface bg-surface-container-low">
        <div className="mx-auto grid max-w-[var(--container-page)] gap-10 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[.8fr_1.2fr]">
          <div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Send a private note</p><h2 className="mt-5 max-w-[10ch] font-display text-5xl font-semibold leading-[.9] tracking-[-.05em]">Write to the newsroom</h2><p className="mt-6 max-w-md text-lg leading-relaxed text-on-surface-variant">Corrections, tips and press enquiries. We reply by email; nothing from this form is published.</p></div>
          <div className="border-l-4 border-secondary bg-surface-container-lowest p-5 md:p-8"><ContactForm /></div>
        </div>
      </section>
    </StandingPageView>
  )
}
