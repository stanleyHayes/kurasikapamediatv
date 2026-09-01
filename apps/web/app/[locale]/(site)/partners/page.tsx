import { setRequestLocale } from 'next-intl/server'
import { loadAffiliateLinks } from '@kurasikapa/web-kit/bff/revenue'
import { AffiliateMarket } from '@/components/commerce/affiliate-market'

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> {
  const { locale } = await params; setRequestLocale(locale)
  return <AffiliateMarket links={await loadAffiliateLinks()}/>
}
