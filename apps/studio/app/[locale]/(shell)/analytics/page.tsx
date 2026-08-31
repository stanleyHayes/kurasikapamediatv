import { NotPermitted } from '@kurasikapa/domain'
import { setRequestLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { NewsroomAnalytics } from '@/components/newsroom-analytics'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'

const period = (value: string | undefined): 7 | 30 | 90 => value === '7' || value === '90' ? Number(value) as 7 | 90 : 30

export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }): Promise<React.ReactElement> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  const days = period(query.days)
  const report = await container().buildNewsroomReport.execute({ actor, days }).catch((error: unknown) => {
    if (error instanceof NotPermitted) redirect(`/${locale}`)
    throw error
  })
  return <NewsroomAnalytics report={report} days={days} />
}
