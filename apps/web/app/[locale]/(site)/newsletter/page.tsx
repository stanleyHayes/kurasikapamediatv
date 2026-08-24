import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { NewsletterForm } from '@/components/newsletter/newsletter-form'
import { vapidPublicKey } from '@kurasikapa/web-kit/composition/outbound'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
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
    <section className="mx-auto max-w-[var(--container-page)] px-6 py-[var(--space-lg)]">
      <header className="signal-grid relative overflow-hidden border-y-4 border-on-surface bg-secondary-container px-7 py-14 md:px-14 md:py-20">
      <p className="eyebrow text-primary-ink mb-5">Inbox edition / Daily</p>
      <h1 className="relative max-w-[12ch] font-display text-on-surface text-[length:var(--text-display-lg)] font-semibold">
        The Daily Briefing
      </h1>
      <p className="text-on-surface-variant relative mt-6 max-w-xl border-l-4 border-primary pl-5 text-[length:var(--text-body-lg)]">
        Curated journalism, in the language you read. We mail nothing until you
        confirm the address — the same integrity rule as everything else we publish.
      </p>
      <div aria-hidden className="absolute bottom-0 right-6 text-[12rem] font-black leading-none text-primary/10">@</div>
      </header>
      <div className="mx-auto max-w-2xl">
      <NewsletterForm locale={locale} />
      <PushOptIn locale={locale} vapidPublicKey={vapidPublicKey()} />
      <p className="text-on-surface-variant mt-8 text-sm">
        Already subscribed?{' '}
        <Link href="/newsletter/unsubscribe" className="text-secondary-ink underline">
          Unsubscribe
        </Link>
      </p>
      </div>
    </section>
  )
}
