import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { StandingPageView } from '@/components/standing-page'
import { cmsPageFor } from '@/content/cms-page'

const LEGAL = ['privacy', 'terms', 'cookies'] as const
type LegalDoc = (typeof LEGAL)[number]

const isLegal = (value: string): value is LegalDoc => (LEGAL as readonly string[]).includes(value)

interface Params {
  params: Promise<{ locale: string; doc: string }>
}

/** Enumerated, so the three legal pages prerender rather than stream. */
export function generateStaticParams(): { doc: string }[] {
  return LEGAL.map((doc) => ({ doc }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, doc } = await params
  if (!isLegal(doc)) return { title: 'Not found', robots: { index: false } }

  return {
    title: (await cmsPageFor(doc, locale)).title,
    alternates: { canonical: `/${locale}/legal/${doc}` },
  }
}

export default async function LegalPage({ params }: Params): Promise<React.ReactElement> {
  const { locale, doc } = await params
  setRequestLocale(locale)

  if (!isLegal(doc)) notFound()

  return <StandingPageView page={await cmsPageFor(doc, locale)} pageKey={doc} />
}
