import Link from 'next/link'
import type { Route } from 'next'
import type { EventView } from '@kurasikapa/web-kit/bff/events'
import { formatInZone } from '@kurasikapa/web-kit/time/zoned'
import { StatusChip, TYPE_LABELS, cityOf } from './event-fields'

/**
 * The index. Rows link out; nothing is edited or published here.
 *
 * Server-rendered on purpose — it holds no state now that the form and the
 * lifecycle controls live on their own pages.
 */
export function EventList({ events, locale }: { events: readonly EventView[]; locale: string }): React.ReactElement {
  if (events.length === 0) return <Empty locale={locale} />
  const drafts = events.filter((event) => !event.published).length

  return (
    <section className="space-y-4">
      <p className="text-sm text-on-surface-variant">{drafts} draft{drafts === 1 ? '' : 's'} · {events.length - drafts} published</p>
      <ul className="grid gap-4 lg:grid-cols-2">
        {events.map((event) => <EventCard key={event.id} event={event} locale={locale} />)}
      </ul>
    </section>
  )
}

function EventCard({ event, locale }: { event: EventView; locale: string }): React.ReactElement {
  const zone = event.timezone === '' ? 'UTC' : event.timezone

  return (
    <li className={`border ${event.published ? 'border-outline-variant bg-surface-container-low' : 'border-dashed border-secondary bg-secondary-container/20'}`}>
      <Link href={`/${locale}/events/${event.id}` as Route} className="block p-5 transition-colors hover:bg-surface-container">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip published={event.published} />
          <span className="text-[10px] font-bold uppercase tracking-[.14em] text-primary-ink">
            {TYPE_LABELS[event.type]} · {formatInZone(event.startsAt, zone, locale)} ({cityOf(zone)})
          </span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold">{event.title}</h2>
        <p className="mt-2 line-clamp-2 text-sm text-on-surface-variant">{event.summary}</p>
        <span className="mt-4 inline-block text-xs font-bold text-primary">Open →</span>
      </Link>
    </li>
  )
}

function Empty({ locale }: { locale: string }): React.ReactElement {
  return (
    <div className="signal-grid border border-outline-variant p-10 text-center">
      <span aria-hidden className="mx-auto grid size-12 place-items-center bg-primary text-xl text-on-primary">◇</span>
      <h2 className="mt-4 font-display text-xl font-bold">The events desk is ready.</h2>
      <p className="mt-2 text-sm text-on-surface-variant">Draft the first gathering, review it, then publish it to the public calendar.</p>
      <Link href={`/${locale}/events/new` as Route} className="mt-5 inline-block bg-primary px-5 py-3 text-sm font-bold text-on-primary">Draft an event</Link>
    </div>
  )
}
