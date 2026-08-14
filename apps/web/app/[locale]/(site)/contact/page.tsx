import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { ContactForm } from '@/components/contact/contact-form'
import { StandingPageView } from '@/components/standing-page'
import { type StandingParams, standingRoute } from '@/content/standing-route'
import { pageFor } from '@/content/pages'

const route = standingRoute('contact', 'contact')

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
    <div>
      <StandingPageView page={pageFor('contact', locale)} />
      <section className="mx-auto max-w-[var(--container-page)] px-6 pb-[var(--space-xl)]">
        <h2 className="font-display text-on-surface text-[length:var(--text-headline-sm)] font-semibold">
          Write to the newsroom
        </h2>
        <p className="text-on-surface-variant mt-2 max-w-xl text-[length:var(--text-body-lg)]">
          Corrections, tips and press enquiries. We reply by email — nothing is
          published from this form.
        </p>
        <ContactForm />
      </section>
    </div>
  )
}
