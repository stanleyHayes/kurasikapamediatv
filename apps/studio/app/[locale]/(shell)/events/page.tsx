import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadEvents } from '@kurasikapa/web-kit/bff/events'
import { loadMediaAssets } from '@kurasikapa/web-kit/bff/media-library'
import { EventManager } from '@/components/event-manager'

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params; setRequestLocale(locale)
  const actor = await requireActor(locale); const [events, assets] = await Promise.all([loadEvents(locale), loadMediaAssets(actor, locale)])
  return <div className="space-y-7"><header className="border-b border-outline-variant pb-6"><p className="broadcast-kicker text-primary">Community &amp; convening</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">Events &amp; summits</h1><p className="mt-3 max-w-3xl text-on-surface-variant">Publish newsroom webinars, public conversations and conferences with accountable speakers, clear timing, accessible imagery and secure registration links.</p></header><EventManager locale={locale} events={events} assets={assets}/></div>
}
