'use server'

import type { BroadcastId } from '@kurasikapa/domain'
import { z } from 'zod'
import { type ActionResult, attempt } from '@kurasikapa/web-kit/actions/result'
import { parseInput } from '@kurasikapa/web-kit/actions/schemas'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { enforceLiveActionPolicy } from '@/live/action-policy'

const startSchema = z.object({
  title: z.string().trim().min(3).max(120),
  locale: z.enum(['en', 'fr']),
})

const endSchema = z.object({ broadcastId: z.string().min(1), locale: z.enum(['en', 'fr']) })

export interface EncoderCredentials {
  readonly broadcastId: string
  readonly ingestEndpoint: string
  readonly streamKey: string
  readonly playbackUrl: string
}

export async function startBroadcastAction(input: unknown): Promise<ActionResult<EncoderCredentials>> {
  return attempt(async () => {
    const parsed = parseInput(startSchema, input)
    const actor = await requireActor()
    await enforceLiveActionPolicy('start', container().rateLimiter, actor.id)

    const result = await container().startBroadcast.execute({ actor, ...parsed })
    return result
  })
}

export async function endBroadcastAction(input: unknown): Promise<ActionResult<{ endedAt: string }>> {
  return attempt(async () => {
    const parsed = parseInput(endSchema, input)
    const actor = await requireActor()
    await enforceLiveActionPolicy('end', container().rateLimiter, actor.id)
    const result = await container().endBroadcast.execute({
      actor,
      broadcastId: parsed.broadcastId as BroadcastId,
    })
    return { endedAt: result.endedAt.toISOString() }
  })
}
