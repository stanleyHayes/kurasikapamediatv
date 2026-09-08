import type { Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadStudioEvent } from '@kurasikapa/web-kit/bff/events'
import { loadMediaAssets } from '@kurasikapa/web-kit/bff/media-library'
import { EventForm } from '@/components/event-form'
import { EventLifecycle } from '@/components/event-lifecycle'
import { StatusChip } from '@/components/event-fields'

/** One event: its edit form, with the publication controls beside it. */
export default async function EventPage({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<React.ReactElement> {
  const { locale, id } = await params
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  const [event, assets] = await Promise.all([loadStudioEvent(actor, id), loadMediaAssets(actor, locale)])
  if (event === null) notFound()

  return (
    <div className="space-y-7">
      <header className="border-b border-outline-variant pb-6">
        <Link href={`/${locale}/events` as Route} className="text-xs font-bold text-primary">← Events</Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusChip published={event.published} />
          <h1 className="font-display text-4xl font-bold tracking-tight">{event.title}</h1>
        </div>
      </header>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
        <EventForm locale={locale} images={assets.filter((asset) => asset.kind === 'image' && asset.status === 'ready')} editing={event} />
        <EventLifecycle event={event} locale={locale} />
      </div>
    </div>
  )
}
