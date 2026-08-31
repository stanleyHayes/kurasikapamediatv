import { setRequestLocale } from 'next-intl/server'
import { TelevisionManager } from '@/components/television-manager'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { loadTelevisionGuide } from '@kurasikapa/web-kit/bff/television'

export default async function TelevisionPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  if (!actor.can('stream:manage')) throw new Error('Not permitted to manage television programming')
  const guide = await loadTelevisionGuide(locale, async () => {
    const loaded = await container().listTelevisionGuide.execute({ locale, from: new Date() })
    return {
      presenters: loaded.presenters.map((person) => ({ ...person.snapshot(), portraitAssetId: null })),
      programmes: loaded.programmes.map(({ programme, presenters }) => ({
        programme: { ...programme.snapshot(), artworkAssetId: null },
        presenters: presenters.map((person) => ({ ...person.snapshot(), portraitAssetId: null })),
      })),
      upcoming: loaded.upcoming.map(({ slot, programme }) => ({
        slot: { ...slot.snapshot(), startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() },
        programme: { ...programme.snapshot(), artworkAssetId: null },
      })),
      replays: loaded.replays.map(({ slot, programme }) => ({
        slot: { ...slot.snapshot(), startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() },
        programme: { ...programme.snapshot(), artworkAssetId: null },
      })),
    }
  })
  const presenters = guide.presenters.map((item) => ({ id: item.id, name: item.name, role: item.role }))
  const programmes = guide.programmes.map(({ programme, presenters: hosts }) => ({ id: programme.id, title: programme.title, category: programme.category, presenters: hosts.map((item) => ({ id: item.id, name: item.name, role: item.role })) }))
  const upcoming = guide.upcoming.map(({ slot, programme }) => ({ id: slot.id, title: programme.title, startsAt: slot.startsAt, isLive: slot.isLive }))
  return <div className="space-y-7"><header className="border-b border-outline-variant pb-6"><p className="broadcast-kicker text-primary">Kurasikapa Media TV</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">Build the television day.</h1><p className="mt-3 max-w-3xl text-on-surface-variant">Publish accountable presenters, define recurring programmes and create the schedule viewers see on the Live page.</p></header><TelevisionManager locale={locale} presenters={presenters} programmes={programmes} upcoming={upcoming} /></div>
}
