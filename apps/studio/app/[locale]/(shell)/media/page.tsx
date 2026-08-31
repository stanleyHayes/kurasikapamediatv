import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadMediaAssets } from '@kurasikapa/web-kit/bff/media-library'
import { MediaLibraryManager } from '@/components/media-library-manager'

export default async function MediaLibraryPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params; setRequestLocale(locale)
  const actor = await requireActor(locale)
  const assets = await loadMediaAssets(actor, locale)
  return <div className="space-y-7"><header className="border-b border-outline-variant pb-6"><p className="broadcast-kicker text-primary">Production inventory</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">Media library</h1><p className="mt-3 max-w-3xl text-on-surface-variant">Manage original photography, video reports, podcast audio, transcripts and captions from one verified newsroom shelf.</p></header><MediaLibraryManager locale={locale} assets={assets} /></div>
}
