import { setRequestLocale } from 'next-intl/server'
import { MembershipManager } from '@/components/membership-manager'
import { RevenueDashboard } from '@/components/revenue-dashboard'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadMembershipPlans, loadRevenueReport } from '@kurasikapa/web-kit/bff/revenue'

const period = (value: string | undefined): 7 | 30 | 90 => value === '7' || value === '90' ? Number(value) as 7 | 90 : 30

export default async function RevenuePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }): Promise<React.ReactElement> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  const [plans, report] = await Promise.all([loadMembershipPlans(locale), loadRevenueReport(actor, period(query.days))])
  return <div className="space-y-14"><RevenueDashboard report={report} /><MembershipManager plans={plans} /></div>
}
