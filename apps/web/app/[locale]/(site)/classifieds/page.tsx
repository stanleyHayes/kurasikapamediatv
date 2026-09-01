import { setRequestLocale } from 'next-intl/server'
import { loadClassifieds } from '@kurasikapa/web-kit/bff/revenue'
import { ClassifiedMarket } from '@/components/commerce/commerce-centre'
export default async function ClassifiedsPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> { const { locale } = await params; setRequestLocale(locale); return <ClassifiedMarket listings={await loadClassifieds()} locale={locale}/> }
