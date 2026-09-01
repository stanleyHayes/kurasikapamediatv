import { setRequestLocale } from 'next-intl/server'
import { MembershipManager } from '@/components/membership-manager'
import { RevenueDashboard } from '@/components/revenue-dashboard'
import { AdvertisingManager } from '@/components/advertising-manager'
import { CommerceManager } from '@/components/commerce-manager'
import { AffiliateManager } from '@/components/affiliate-manager'
import { AdvertiserProposalQueue } from '@/components/advertiser-proposal-queue'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadAdReport, loadAdvertiserProposals, loadAffiliateLinks, loadClassifieds, loadMembershipPlans, loadProducts, loadRevenueReport } from '@kurasikapa/web-kit/bff/revenue'

const period = (value: string | undefined): 7 | 30 | 90 => value === '7' || value === '90' ? Number(value) as 7 | 90 : 30

export default async function RevenuePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }): Promise<React.ReactElement> {
  const [{ locale }, query] = await Promise.all([params, searchParams])
  setRequestLocale(locale)
  const actor = await requireActor(locale)
  const [plans, report, campaigns, proposals, products, classifieds, affiliates] = await Promise.all([loadMembershipPlans(locale), loadRevenueReport(actor, period(query.days)), loadAdReport(actor), loadAdvertiserProposals(actor, true), loadProducts(actor), loadClassifieds(actor), loadAffiliateLinks(actor)])
  return <div className="space-y-20"><RevenueDashboard report={report} /><MembershipManager plans={plans} /><CommerceManager products={products} classifieds={classifieds}/><AffiliateManager links={affiliates}/><AdvertiserProposalQueue proposals={proposals}/><AdvertisingManager campaigns={campaigns} /></div>
}
