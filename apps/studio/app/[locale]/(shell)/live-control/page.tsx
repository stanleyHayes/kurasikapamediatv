import { setRequestLocale } from 'next-intl/server'
import { LiveControlRoom } from '@/components/live-control-room'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'

export default async function LiveControlPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const actor = await requireActor()
  const current = await container().getCurrentBroadcast.execute({ locale })
  const history = await container().listBroadcasts.execute({ actor, locale, limit: 10 })

  return <div className="space-y-7"><header className="border-b border-outline-variant pb-6"><p className="broadcast-kicker text-primary">Kurasikapa Media TV</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-on-surface md:text-5xl">Go live without guessing.</h1><p className="mt-3 max-w-2xl text-on-surface-variant">Provision the channel, connect OBS, monitor the public signal, and close the transmission from one accountable control room.</p></header><LiveControlRoom locale={locale} current={current === null ? null : { id: current.id, title: current.title, startedAt: current.startedAt?.toISOString() ?? null }} history={history.map((broadcast) => ({ id: broadcast.id, title: broadcast.title, state: broadcast.state, startedAt: broadcast.startedAt?.toISOString() ?? null, endedAt: broadcast.endedAt?.toISOString() ?? null }))} /></div>
}
