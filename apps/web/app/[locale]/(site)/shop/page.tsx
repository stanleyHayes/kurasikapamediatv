import { setRequestLocale } from 'next-intl/server'
import { loadProducts } from '@kurasikapa/web-kit/bff/revenue'
import { ProductShop } from '@/components/commerce/commerce-centre'
export default async function ShopPage({ params }: { params: Promise<{ locale: string }> }): Promise<React.ReactElement> { const { locale } = await params; setRequestLocale(locale); return <ProductShop products={await loadProducts()} locale={locale}/> }
