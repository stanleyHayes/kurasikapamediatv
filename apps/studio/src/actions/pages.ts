'use server'

import { SITE_PAGE_KEYS } from '@kurasikapa/domain'
import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'

const schema = z.object({ key: z.enum(SITE_PAGE_KEYS), locale: z.enum(['en', 'fr']), title: z.string().trim().min(1).max(140), lead: z.string().trim().max(280), body: z.string().trim().min(1).max(30_000) })

export async function saveSitePageAction(input: unknown): Promise<ActionResult<{ updatedAt: string }>> {
  return attempt(async () => {
    const parsed = schema.parse(input)
    const actor = await requireActor()
    const page = await container().manageSitePages.execute({ actor, ...parsed })
    return { updatedAt: page.snapshot().updatedAt.toISOString() }
  })
}
