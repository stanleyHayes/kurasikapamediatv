import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LiveSignal } from '@/components/live/live-signal'
import { TelevisionGuide, type GuideData } from '@/components/live/television-guide'
import { AdPlacement } from '@/components/advertising/ad-placement'
import { container } from '@kurasikapa/web-kit/composition/container'
import { loadTelevisionGuide } from '@kurasikapa/web-kit/bff/television'

interface Params { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'livePage' })
  return { title: t('title'), description: t('description'), alternates: { canonical: `/${locale}/live` } }
}

export default async function LivePage({ params }: Params): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('livePage')
  await connection()
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
			programme: { ...programme.snapshot(), artworkAssetId: null }, replay: null,
		})),
		replays: loaded.replays.map(({ slot, programme }) => ({
			slot: { ...slot.snapshot(), startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() },
			programme: { ...programme.snapshot(), artworkAssetId: null }, replay: null,
      })),
    }
  })
  const view: GuideData = {
    programmes: guide.programmes.map(({ programme, presenters }) => ({
      id: programme.id, title: programme.title, slug: programme.slug, summary: programme.summary,
      category: programme.category, presenters: presenters.map((person) => ({ id: person.id, name: person.name, role: person.role })),
    })),
    upcoming: guide.upcoming.map(({ slot, programme }) => ({
		id: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, isLive: slot.isLive,
		programme: { id: programme.id, title: programme.title, slug: programme.slug, category: programme.category },
		replay: null,
	})),
	replays: guide.replays.map(({ slot, programme, replay }) => ({
		id: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, isLive: slot.isLive,
		programme: { id: programme.id, title: programme.title, slug: programme.slug, category: programme.category },
		replay,
	})),
  }
  return <main className="mx-auto w-full max-w-[var(--container-page)] px-4 py-8 md:px-8 md:py-12"><LiveSignal locale={locale} copy={{ title: t('title'), description: t('description'), status: t('status'), onAir: t('onAir'), nowPlaying: t('nowPlaying'), emptyTitle: t('emptyTitle'), emptyDescription: t('emptyDescription') }} /><AdPlacement locale={locale} slot="live_companion" /><TelevisionGuide locale={locale} guide={view} /></main>
}
