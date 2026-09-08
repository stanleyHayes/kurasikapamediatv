import Image from 'next/image'
import type { EventView } from '@kurasikapa/web-kit/bff/events'
import { Link } from '@kurasikapa/web-kit/i18n/navigation'
import { formatInZone } from '@kurasikapa/web-kit/time/zoned'

/**
 * Published upcoming events, on the homepage.
 *
 * The calendar used to live only at /events, so a published event was
 * invisible to anyone who did not already know the page existed. A newsroom
 * that has scheduled something and has not yet published a story should still
 * have something to show.
 *
 * Each time is written in the EVENT's zone with the city named beside it —
 * "19:00 (Paris)" — because a Ghanaian reader looking at a Paris dinner needs
 * to know which clock the number belongs to.
 */
export function UpcomingEvents({ events, locale }: { events: readonly EventView[]; locale: string }): React.ReactElement | null {
  if (events.length === 0) return null
  const french = locale === 'fr'

  return (
    <section className="mx-auto max-w-[var(--container-page)] px-4 pb-[var(--space-xl)] md:px-8">
      <div className="reveal flex items-end justify-between gap-4 border-b-4 border-on-surface pb-5">
        <h2 className="font-display text-on-surface text-[length:var(--text-headline-md)] font-semibold">
          {french ? 'À venir' : 'What’s on'}
        </h2>
        <Link href="/events" className="editorial-link eyebrow text-primary-ink hover:text-secondary-ink transition-colors">
          {french ? 'Tous les événements' : 'All events'}
        </Link>
      </div>

      <ul className="depth-grid mt-8 grid grid-cols-1 gap-x-[var(--space-md)] gap-y-10 md:grid-cols-3">
        {events.slice(0, 3).map((event) => (
          <li key={event.id}>
            <Link href={`/events/${event.slug}`} className="group flex h-full flex-col gap-4">
              <span className="bg-surface-container-low relative block aspect-[16/10] overflow-hidden">
                {event.image !== null && (
                  <Image src={event.image.url} alt={event.image.altText} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                )}
              </span>
              <span className="eyebrow text-primary-ink">{when(event, locale)}</span>
              <h3 className="font-display text-on-surface group-hover:text-secondary-ink text-[length:var(--text-title-lg)] font-semibold leading-tight transition-colors">
                {event.title}
              </h3>
              <p className="text-on-surface-variant line-clamp-2 text-sm leading-6">{event.summary}</p>
              <span className="text-on-surface-variant mt-auto text-xs">{place(event, french)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function when(event: EventView, locale: string): string {
  const zone = event.timezone === '' ? 'UTC' : event.timezone
  const city = (zone.split('/').pop() ?? zone).replaceAll('_', ' ')

  return `${formatInZone(event.startsAt, zone, locale)} (${city})`
}

function place(event: EventView, french: boolean): string {
  if (event.mode === 'online') return french ? 'En ligne' : 'Online'

  return [event.venue, event.city].filter(Boolean).join(', ')
}
