import { setRequestLocale } from 'next-intl/server'
import { MembershipManager } from '@/components/membership-manager'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { loadMembershipPlans } from '@kurasikapa/web-kit/bff/revenue'

export default async function RevenuePage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params
  setRequestLocale(locale)
  await requireActor(locale)
  return <MembershipManager plans={await loadMembershipPlans(locale)} />
}
