import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LiveSignal } from '@/components/live/live-signal'

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
  return <LiveSignal locale={locale} copy={{ title: t('title'), description: t('description'), status: t('status'), onAir: t('onAir'), nowPlaying: t('nowPlaying'), emptyTitle: t('emptyTitle'), emptyDescription: t('emptyDescription') }} />
}
