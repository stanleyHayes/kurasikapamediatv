'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { EVENT_TYPES, createEvent, deleteEvent, publishEvent, unpublishEvent, updateEvent } from '@kurasikapa/web-kit/bff/events'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { isSupportedTimeZone } from '@kurasikapa/web-kit/time/zoned'

const eventSchema = z.object({
  type: z.enum(EVENT_TYPES), mode: z.enum(['online', 'in_person', 'hybrid']),
  title: z.string().trim().min(3).max(160), slug: z.string().trim().min(3).max(180), locale: z.enum(['en', 'fr']),
  summary: z.string().trim().min(20).max(2_000),
  /*
   * Any zone the runtime's tz database knows, not a hardcoded 'Africa/Accra'.
   * The Go domain only ever required a non-empty string; the literal here was
   * the sole reason a Paris event could not be published, and it rejected the
   * request before it ever left Next.
   */
  timezone: z.string().refine(isSupportedTimeZone, { message: 'Unknown time zone' }),
  venue: z.string().trim().max(240), city: z.string().trim().max(120),
  registrationURL: z.union([z.literal(''), z.url().startsWith('https://')]),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), imageAssetID: z.string().min(1).optional(),
  speakers: z.array(z.string().trim().min(2).max(120)).max(20), featured: z.boolean(),
}).refine((value) => new Date(value.endsAt) > new Date(value.startsAt), { path: ['endsAt'], message: 'End time must follow start time' })
  .refine((value) => value.mode === 'online' || value.venue.length > 0, { path: ['venue'], message: 'Add the physical venue' })

/**
 * Saves a DRAFT. It no longer publishes.
 *
 * Creating and publishing in one action is what left events with no reviewable
 * state: whatever an editor typed went straight to the public calendar, and
 * with no edit or delete path a typo could only be fixed in the database.
 */
export async function createEventAction(input: unknown): Promise<ActionResult<{ readonly id: string }>> {
  return attempt(async () => createEvent(await requireActor(), eventSchema.parse(input)))
}

const idSchema = z.object({ id: z.string().trim().min(1) })

/**
 * Corrects an existing listing.
 *
 * The slug is refused by the domain once the event has been published, so a
 * public URL cannot move under a reader who bookmarked it. Everything else
 * stays editable, published or not.
 */
export async function updateEventAction(id: unknown, input: unknown): Promise<ActionResult<undefined>> {
  return attempt(async () => {
    await updateEvent(await requireActor(), idSchema.parse({ id }).id, eventSchema.parse(input))

    return undefined
  })
}

export async function deleteEventAction(input: unknown): Promise<ActionResult<undefined>> {
  return attempt(async () => {
    await deleteEvent(await requireActor(), idSchema.parse(input).id)

    return undefined
  })
}

export async function publishEventAction(input: unknown): Promise<ActionResult<undefined>> {
  return attempt(async () => {
    await publishEvent(await requireActor(), idSchema.parse(input).id)

    return undefined
  })
}

export async function unpublishEventAction(input: unknown): Promise<ActionResult<undefined>> {
  return attempt(async () => {
    await unpublishEvent(await requireActor(), idSchema.parse(input).id)

    return undefined
  })
}
