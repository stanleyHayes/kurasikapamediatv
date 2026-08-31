import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadMediaAssets } from '@kurasikapa/web-kit/bff/media-library'
import { loadPodcasts } from '@kurasikapa/web-kit/bff/podcasts'
import { PodcastManager } from '@/components/podcast-manager'

export default async function PodcastsPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params; setRequestLocale(locale)
  const actor = await requireActor(); const [podcasts, assets] = await Promise.all([loadPodcasts(locale), loadMediaAssets(actor, locale)])
  return <div className="space-y-7"><header className="border-b border-outline-variant pb-6"><p className="broadcast-kicker text-primary">Audio newsroom</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">Podcasts</h1><p className="mt-3 max-w-3xl text-on-surface-variant">Build original audio series, publish chaptered episodes and guarantee every recording has a downloadable transcript.</p></header><PodcastManager locale={locale} podcasts={podcasts} assets={assets}/></div>
}
