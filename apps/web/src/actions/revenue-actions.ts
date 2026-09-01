'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { parseInput } from '@kurasikapa/web-kit/actions/schemas'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { env } from '@kurasikapa/web-kit/composition/env'
import { recordAdEvent, startClassifiedCheckout, startDonationCheckout, startMembershipCheckout, startProductCheckout, type CheckoutView } from '@kurasikapa/web-kit/bff/revenue'

const locale = z.enum(['en', 'fr'])
const email = z.email().max(320)

export async function startMembershipAction(input: unknown): Promise<ActionResult<CheckoutView>> {
  return attempt(async () => {
    const parsed = parseInput(z.object({ planID: z.string().min(1).max(100), email, locale }), input)
    return startMembershipCheckout(await requireActor(), {
      planID: parsed.planID, email: parsed.email, returnURL: returnURL(parsed.locale),
    })
  })
}

export async function startDonationAction(input: unknown): Promise<ActionResult<CheckoutView>> {
  return attempt(async () => {
    const parsed = parseInput(z.object({ amountMinor: z.number().int().min(500).max(10_000_000), currency: z.enum(['GHS', 'EUR']), email, message: z.string().trim().max(500), anonymous: z.boolean(), locale }), input)
    return startDonationCheckout({ amount: { minor: parsed.amountMinor, currency: parsed.currency }, email: parsed.email,
      message: parsed.message, anonymous: parsed.anonymous, returnURL: returnURL(parsed.locale) })
  })
}

export async function recordAdEventAction(input: unknown): Promise<ActionResult<Record<string, never>>> {
  return attempt(async () => {
    const parsed = parseInput(z.object({ campaignId: z.string().min(1).max(100), kind: z.enum(['impression', 'click']) }), input)
    await recordAdEvent(parsed.campaignId, parsed.kind)
    return {}
  })
}

export async function startProductAction(input: unknown): Promise<ActionResult<CheckoutView>> {
  return attempt(async () => { const parsed = parseInput(z.object({ productID: z.string().min(1), quantity: z.number().int().min(1).max(20), email, deliveryName: z.string().trim().min(2).max(120), deliveryAddress: z.string().trim().min(10).max(500), locale }), input); return startProductCheckout({ ...parsed, returnURL: commerceReturnURL(parsed.locale, 'shop') }) })
}

export async function startClassifiedAction(input: unknown): Promise<ActionResult<CheckoutView>> {
  return attempt(async () => { const parsed = parseInput(z.object({ title: z.string().trim().min(5).max(120), category: z.string().trim().min(2).max(80), description: z.string().trim().min(30).max(2000), location: z.string().trim().min(2).max(120), contactName: z.string().trim().min(2).max(120), contactEmail: email, contactPhone: z.string().trim().max(40), imageURL: z.union([z.literal(''), z.url().startsWith('https://')]), amountMinor: z.number().int().positive(), currency: z.enum(['GHS', 'EUR']), locale }), input); return startClassifiedCheckout({ ...parsed, askingPrice: { minor: parsed.amountMinor, currency: parsed.currency }, returnURL: commerceReturnURL(parsed.locale, 'classifieds') }) })
}

function returnURL(localeValue: 'en' | 'fr'): string {
  return new URL(`/${localeValue}/support?checkout=return`, env().APP_URL).toString()
}
function commerceReturnURL(localeValue: 'en' | 'fr', route: string): string { return new URL(`/${localeValue}/${route}?checkout=return`, env().APP_URL).toString() }
