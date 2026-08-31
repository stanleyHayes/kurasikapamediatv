import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { loadPodcasts } from '@kurasikapa/web-kit/bff/podcasts'
import { PodcastLibrary } from '@/components/podcast-library'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return { title: locale === 'fr' ? 'Podcasts | Kurasikapa Media TV' : 'Podcasts | Kurasikapa Media TV', description: locale === 'fr' ? 'Écoutez les podcasts originaux de Kurasikapa avec chapitres et transcriptions.' : 'Listen to original Kurasikapa podcasts with chapters and complete transcripts.' }
}

export default async function PodcastsPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params; setRequestLocale(locale)
  const podcasts = await loadPodcasts(locale)
  const french = locale === 'fr'
  return <main><header className="border-b-8 border-secondary bg-[#08150d] px-5 py-16 text-white md:px-8 md:py-24"><div className="mx-auto max-w-[var(--container-page)]"><p className="broadcast-kicker text-secondary">Kurasikapa Audio / Accra</p><h1 className="mt-4 max-w-5xl font-display text-6xl font-bold leading-[.88] tracking-[-.06em] md:text-8xl">{french ? 'Des voix qui donnent du sens.' : 'Voices that make the news make sense.'}</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">{french ? 'Entretiens originaux, reportages audio et explications de la rédaction — accessibles avec chapitres et transcriptions.' : 'Original interviews, audio reporting and newsroom explainers—accessible with chapters and complete transcripts.'}</p></div></header><div className="mx-auto max-w-[var(--container-page)] px-5 py-14 md:px-8 md:py-20"><PodcastLibrary locale={locale} podcasts={podcasts}/></div></main>
}
