'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { createAndPublishEvent } from '@kurasikapa/web-kit/bff/events'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'

const eventSchema = z.object({
  type: z.enum(['webinar', 'conference', 'summit']), mode: z.enum(['online', 'in_person', 'hybrid']),
  title: z.string().trim().min(3).max(160), slug: z.string().trim().min(3).max(180), locale: z.enum(['en', 'fr']),
  summary: z.string().trim().min(20).max(2_000), timezone: z.literal('Africa/Accra'),
  venue: z.string().trim().max(240), city: z.string().trim().max(120),
  registrationURL: z.union([z.literal(''), z.url().startsWith('https://')]),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), imageAssetID: z.string().min(1).optional(),
  speakers: z.array(z.string().trim().min(2).max(120)).max(20), featured: z.boolean(),
}).refine((value) => new Date(value.endsAt) > new Date(value.startsAt), { path: ['endsAt'], message: 'End time must follow start time' })
  .refine((value) => value.mode === 'online' || value.venue.length > 0, { path: ['venue'], message: 'Add the physical venue' })

export async function createEventAction(input: unknown): Promise<ActionResult<{ readonly id: string }>> {
  return attempt(async () => createAndPublishEvent(await requireActor(), eventSchema.parse(input)))
}
