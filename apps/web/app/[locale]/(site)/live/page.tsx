import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

interface Params {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'livePage' })
  return { title: t('title'), description: t('description'), alternates: { canonical: `/${locale}/live` } }
}

export default async function LivePage({ params }: Params): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('livePage')

  return (
    <main className="mx-auto w-full max-w-[var(--container-page)] px-4 py-8 md:px-8 md:py-12">
      <section className="signal-grid bg-[#08150d] relative min-h-[34rem] overflow-hidden border-b-[0.75rem] border-secondary px-7 py-16 text-white md:px-14 md:py-24">
        <div aria-hidden className="absolute right-8 top-8 flex items-center gap-3 border border-white/20 px-4 py-2 text-xs font-bold tracking-[0.16em] uppercase">
          <span className="h-2.5 w-2.5 bg-secondary" /> {t('status')}
        </div>
        <div className="relative max-w-3xl">
          <p className="eyebrow mb-6 text-secondary">Kurasikapa Media TV / Accra</p>
          <h1 className="font-display text-[4rem] font-bold leading-[0.88] tracking-[-0.055em] md:text-[7rem]">{t('title')}</h1>
          <p className="mt-8 max-w-2xl border-l-4 border-secondary pl-6 text-lg leading-relaxed text-white/70 md:text-xl">{t('description')}</p>
          <div className="mt-12 grid max-w-2xl grid-cols-[auto_1fr] border border-white/20">
            <span aria-hidden className="grid min-h-24 w-24 place-items-center bg-secondary text-3xl text-on-secondary">▶</span>
            <div className="flex flex-col justify-center px-6 py-5">
              <strong className="text-lg">{t('emptyTitle')}</strong>
              <span className="mt-1 text-sm leading-relaxed text-white/60">{t('emptyDescription')}</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
