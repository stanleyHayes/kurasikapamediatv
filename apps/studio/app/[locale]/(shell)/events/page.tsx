import type { Route } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadStudioEvents } from '@kurasikapa/web-kit/bff/events'
import { EventList } from '@/components/event-list'

/** The index only. Creating and editing each have their own page. */
export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  const events = await loadStudioEvents(actor, locale)

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <p className="broadcast-kicker text-primary">Community &amp; convening</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">Events &amp; summits</h1>
          <p className="mt-3 max-w-3xl text-on-surface-variant">Nothing here reaches readers until you publish it, and anything published can be pulled back.</p>
        </div>
        <Link href={`/${locale}/events/new` as Route} className="bg-primary px-5 py-3 text-sm font-bold text-on-primary">Draft an event</Link>
      </header>
      <EventList events={events} locale={locale} />
    </div>
  )
}
