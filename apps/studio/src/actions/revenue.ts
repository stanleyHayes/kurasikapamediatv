'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { parseInput } from '@kurasikapa/web-kit/actions/schemas'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { createAndActivateMembershipPlan } from '@kurasikapa/web-kit/bff/revenue'

const schema = z.object({ name: z.string().trim().min(2).max(80), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u), description: z.string().trim().min(20).max(500), interval: z.enum(['monthly', 'yearly']), currency: z.enum(['GHS', 'EUR']), amountMinor: z.number().int().min(500).max(10_000_000), benefits: z.array(z.string().trim().min(2).max(120)).min(1).max(8) })

export async function createMembershipPlanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const parsed = parseInput(schema, input)
    return createAndActivateMembershipPlan(await requireActor(), {
      name: parsed.name, slug: parsed.slug, description: parsed.description,
      interval: parsed.interval, price: { minor: parsed.amountMinor, currency: parsed.currency },
      benefits: parsed.benefits,
    })
  })
}
