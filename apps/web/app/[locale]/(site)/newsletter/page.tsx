import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { NewsletterForm } from '@/components/newsletter/newsletter-form'
import { vapidPublicKey } from '@/composition/outbound'
import { Link } from '@/i18n/navigation'
import { PushOptIn } from '@/pwa/push-opt-in'

interface Params {
  params: Promise<{ locale: string }>
}

export default function NewsletterPage({ params }: Params): React.ReactElement {
  return (
    <Suspense fallback={<p className="text-on-surface-variant">Loading…</p>}>
      <Body params={params} />
    </Suspense>
  )
}

async function Body({ params }: Params): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--spacing-lg)]">
      <h1 className="font-display text-on-surface text-[length:var(--text-headline-lg)] font-semibold">
        The Daily Briefing
      </h1>
      <p className="text-on-surface-variant mt-4 max-w-xl text-[length:var(--text-body-lg)]">
        Curated journalism, in the language you read. We mail nothing until you
        confirm the address — the same integrity rule as everything else we publish.
      </p>
      <NewsletterForm locale={locale} />
      <PushOptIn locale={locale} vapidPublicKey={vapidPublicKey()} />
      <p className="text-on-surface-variant mt-8 text-sm">
        Already subscribed?{' '}
        <Link href="/newsletter/unsubscribe" className="text-secondary underline">
          Unsubscribe
        </Link>
      </p>
    </section>
  )
}
