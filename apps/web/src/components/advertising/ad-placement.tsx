import type { AdSlotView } from '@kurasikapa/web-kit/bff/revenue'
import { loadAdPlacement } from '@kurasikapa/web-kit/bff/revenue'
import { AdDelivery } from './ad-delivery'

export async function AdPlacement({ locale, slot }: { readonly locale: string; readonly slot: AdSlotView }): Promise<React.ReactElement | null> {
  const placement = await loadAdPlacement(locale, slot)
  return placement === null ? null : <AdDelivery placement={placement} slot={slot} />
}
