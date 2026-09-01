'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { parseInput } from '@kurasikapa/web-kit/actions/schemas'
import { followAffiliateLink } from '@kurasikapa/web-kit/bff/revenue'

export async function followAffiliateAction(input: unknown): Promise<ActionResult<{ destinationURL: string }>> {
  return attempt(async () => ({ destinationURL: await followAffiliateLink(parseInput(z.object({ id: z.string().min(1).max(100) }), input).id) }))
}
