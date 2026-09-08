import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { loadEvent, type EventView } from '@kurasikapa/web-kit/bff/events'
import { countryForTimeZone, formatInZone } from '@kurasikapa/web-kit/time/zoned'

interface Params { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  const event = await loadEvent(locale, slug)
  if (event === null) return { title: locale === 'fr' ? 'Événement introuvable' : 'Event not found' }

  return {
    title: `${event.title} | Kurasikapa Media TV`,
    description: event.summary.slice(0, 200),
    ...(event.image === null ? {} : { openGraph: { images: [event.image.url] } }),
  }
}

/**
 * One event, at its own URL.
 *
 * The listing could only ever show a card, so a reader had nowhere to be sent
 * and nothing to share. `await params` happens inside the Suspense boundary —
 * see CLAUDE.md — so the page chrome still prerenders.
 */
export default function EventDetailPage({ params }: Params): React.ReactElement {
  return (
    <main className="bg-[#07140d] text-white">
      <Suspense fallback={<div className="min-h-[60vh]" aria-hidden />}>
        <Detail params={params} />
      </Suspense>
    </main>
  )
}

async function Detail({ params }: Params): Promise<React.ReactElement> {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const event = await loadEvent(locale, slug)
  if (event === null) notFound()
  const french = locale === 'fr'

  return (
    <article className="mx-auto max-w-[var(--container-page)] px-5 py-12 md:px-8 md:py-20">
      <EventSchema event={event} locale={locale} />
      {event.image !== null && (
        <div className="relative mb-10 aspect-[16/7] overflow-hidden border border-white/15">
          <Image src={event.image.url} alt={event.image.altText} fill priority sizes="(max-width: 1200px) 100vw, 1200px" className="object-cover" />
        </div>
      )}
      <p className="text-xs font-bold tracking-[.14em] text-secondary uppercase">{event.type} · {event.mode.replace('_', ' ')}</p>
      <h1 className="mt-4 font-display text-5xl font-bold leading-[.95] tracking-[-.04em] md:text-7xl">{event.title}</h1>
      <p className="mt-7 max-w-3xl text-lg leading-8 text-white/75">{event.summary}</p>

      <Facts event={event} locale={locale} french={french} />
      <Actions event={event} locale={locale} french={french} />
    </article>
  )
}

function Facts({ event, locale, french }: { event: EventView; locale: string; french: boolean }): React.ReactElement {
  return (
    <dl className="mt-10 grid max-w-4xl gap-6 border-t border-white/15 pt-7 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <Fact label={french ? 'Début' : 'Starts'} value={when(event.startsAt, event, locale)} />
      <Fact label={french ? 'Fin' : 'Ends'} value={when(event.endsAt, event, locale)} />
      <Fact label={french ? 'Lieu' : 'Place'} value={place(event, french)} />
      <Fact label={french ? 'Intervenants' : 'Speakers'} value={event.speakers.join(', ') || (french ? 'À annoncer' : 'To be announced')} />
    </dl>
  )
}

function Actions({ event, locale, french }: { event: EventView; locale: string; french: boolean }): React.ReactElement {
  return (
    <div className="mt-10 flex flex-wrap gap-3">
      {event.registrationUrl === ''
        ? <span className="bg-white/10 px-6 py-3 text-xs font-bold tracking-[.1em] text-white/55 uppercase">{french ? 'Inscription bientôt' : 'Registration soon'}</span>
        : <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className="bg-secondary px-6 py-3 text-xs font-bold tracking-[.1em] text-on-secondary uppercase hover:brightness-105">{french ? 'S’inscrire' : 'Register now'}</a>}
      <a href={calendarUrl(event)} target="_blank" rel="noreferrer" className="border border-white/30 bg-white/8 px-6 py-3 text-xs font-bold tracking-[.1em] uppercase hover:border-secondary">{french ? 'Ajouter au calendrier' : 'Add to calendar'}</a>
      <a href={`/${locale}/events`} className="border border-white/20 px-6 py-3 text-xs font-bold tracking-[.1em] uppercase hover:border-white/50">{french ? 'Tous les événements' : 'All events'}</a>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-[.12em] text-secondary uppercase">{label}</dt>
      <dd className="mt-2 leading-6 text-white/75">{value}</dd>
    </div>
  )
}

function EventSchema({ event, locale }: { event: EventView; locale: string }): React.ReactElement {
  const country = countryForTimeZone(event.timezone)
  const data = {
    '@context': 'https://schema.org', '@type': 'Event', name: event.title, description: event.summary,
    startDate: event.startsAt, endDate: event.endsAt,
    eventAttendanceMode: attendance(event.mode), eventStatus: 'https://schema.org/EventScheduled',
    inLanguage: locale, image: event.image === null ? undefined : [event.image.url],
    location: event.mode === 'online'
      ? { '@type': 'VirtualLocation', url: event.registrationUrl }
      : {
          '@type': 'Place', name: event.venue,
          address: { '@type': 'PostalAddress', addressLocality: event.city, ...(country === undefined ? {} : { addressCountry: country }) },
        },
    performer: event.speakers.map((name) => ({ '@type': 'Person', name })),
    offers: event.registrationUrl === '' ? undefined : { '@type': 'Offer', url: event.registrationUrl, availability: 'https://schema.org/InStock' },
  }

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll('<', '\\u003c') }} />
}

function attendance(mode: EventView['mode']): string {
  return mode === 'online' ? 'https://schema.org/OnlineEventAttendanceMode' : mode === 'in_person' ? 'https://schema.org/OfflineEventAttendanceMode' : 'https://schema.org/MixedEventAttendanceMode'
}
function when(iso: string, event: EventView, locale: string): string {
  const zone = event.timezone === '' ? 'UTC' : event.timezone
  return `${formatInZone(iso, zone, locale)} (${(zone.split('/').pop() ?? zone).replaceAll('_', ' ')})`
}
function place(event: EventView, french: boolean): string {
  return event.mode === 'online' ? (french ? 'En ligne' : 'Online') : [event.venue, event.city].filter(Boolean).join(', ')
}
function calendarUrl(event: EventView): string {
  const dates = `${compact(event.startsAt)}/${compact(event.endsAt)}`
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${dates}&details=${encodeURIComponent(event.summary)}&location=${encodeURIComponent(place(event, false))}`
}
function compact(input: string): string { return new Date(input).toISOString().replaceAll('-', '').replaceAll(':', '').replace('.000', '') }
