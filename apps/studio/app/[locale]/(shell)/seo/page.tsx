import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { SEOCenter } from '@/components/seo-center'
import { loadSEOReport } from '@kurasikapa/web-kit/bff/seo'
import { ApiProblem } from '@kurasikapa/web-kit/bff/problem'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'

interface Query { readonly severity?: string; readonly language?: string }

export default async function SEOPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Query> }): Promise<React.ReactElement> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  const report = await loadSEOReport(actor).catch((error: unknown) => {
    if (error instanceof ApiProblem && error.type === 'not_permitted') redirect(`/${locale}`)
    throw error
  })
  const severity = query.severity === 'critical' || query.severity === 'warning' ? query.severity : 'all'
  const language = query.language === 'en' || query.language === 'fr' ? query.language : 'all'
  return <SEOCenter report={report} severity={severity} language={language} />
}
