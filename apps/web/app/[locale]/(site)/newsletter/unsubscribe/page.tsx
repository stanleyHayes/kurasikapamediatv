import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { UnsubscribeForm } from '@/components/newsletter/unsubscribe-form'

interface Params {
  params: Promise<{ locale: string }>
}

export default function UnsubscribePage({ params }: Params): React.ReactElement {
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
        Leave the briefing
      </h1>
      <p className="text-on-surface-variant mt-4 max-w-xl">
        Enter the address you used to subscribe. Unknown addresses are treated the
        same as confirmed ones, so this page does not reveal who is on the list.
      </p>
      <UnsubscribeForm />
    </section>
  )
}