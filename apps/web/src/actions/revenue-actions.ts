'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { parseInput } from '@kurasikapa/web-kit/actions/schemas'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { env } from '@kurasikapa/web-kit/composition/env'
import { startDonationCheckout, startMembershipCheckout, type CheckoutView } from '@kurasikapa/web-kit/bff/revenue'

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

function returnURL(localeValue: 'en' | 'fr'): string {
  return new URL(`/${localeValue}/support?checkout=return`, env().APP_URL).toString()
}
