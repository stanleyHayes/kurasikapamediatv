import { setRequestLocale } from 'next-intl/server'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadGalleries } from '@kurasikapa/web-kit/bff/galleries'
import { loadMediaAssets } from '@kurasikapa/web-kit/bff/media-library'
import { GalleryManager } from '@/components/gallery-manager'

export default async function GalleriesPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params; setRequestLocale(locale)
  const actor = await requireActor(); const [galleries, assets] = await Promise.all([loadGalleries(locale), loadMediaAssets(actor, locale)])
  return <div className="space-y-7"><header className="border-b border-outline-variant pb-6"><p className="broadcast-kicker text-primary">Visual newsroom</p><h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">Photo &amp; video galleries</h1><p className="mt-3 max-w-3xl text-on-surface-variant">Curate original visual reporting from verified assets. Every image keeps its alt text and every video requires synchronized captions before publication.</p></header><GalleryManager locale={locale} galleries={galleries} assets={assets}/></div>
}
