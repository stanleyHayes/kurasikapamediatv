import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { loadGalleries } from '@kurasikapa/web-kit/bff/galleries'
import { GalleryLibrary } from '@/components/gallery-library'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return { title: 'Visual stories | Kurasikapa Media TV', description: locale === 'fr' ? 'Reportages photo originaux et vidéos accessibles de Kurasikapa.' : 'Original photo journalism and accessible video reports from Kurasikapa.' }
}
export default async function GalleriesPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params; setRequestLocale(locale); const galleries = await loadGalleries(locale); const french = locale === 'fr'
  return <main><header className="border-b-8 border-secondary bg-[#08150d] px-5 py-16 text-white md:px-8 md:py-24"><div className="mx-auto max-w-[var(--container-page)]"><p className="broadcast-kicker text-secondary">Kurasikapa Visual / Accra</p><h1 className="mt-4 max-w-5xl font-display text-6xl font-bold leading-[.88] tracking-[-.06em] md:text-8xl">{french ? 'Voir l’histoire entière.' : 'See the whole story.'}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">{french ? 'Photojournalisme original, reportages vidéo sous-titrés et contexte de la rédaction.' : 'Original photojournalism, captioned video reports and the newsroom context behind every frame.'}</p></div></header><div className="mx-auto max-w-[var(--container-page)] px-5 py-14 md:px-8 md:py-20"><GalleryLibrary locale={locale} galleries={galleries}/></div></main>
}
