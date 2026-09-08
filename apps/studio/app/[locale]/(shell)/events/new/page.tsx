import type { Route } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadMediaAssets } from '@kurasikapa/web-kit/bff/media-library'
import { EventForm } from '@/components/event-form'

export default async function NewEventPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  const assets = await loadMediaAssets(actor, locale)

  return (
    <div className="space-y-7">
      <header className="border-b border-outline-variant pb-6">
        <Link href={`/${locale}/events` as Route} className="text-xs font-bold text-primary">← Events</Link>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">Draft an event</h1>
        <p className="mt-3 max-w-3xl text-on-surface-variant">This saves a draft. You review it and publish from the event’s own page.</p>
      </header>
      <EventForm locale={locale} images={assets.filter((asset) => asset.kind === 'image' && asset.status === 'ready')} editing={null} />
    </div>
  )
}
