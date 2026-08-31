'use server'

import { presenterId, programmeId } from '@kurasikapa/domain'
import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { createAndPublishPresenter, createAndPublishProgramme, createSchedule, publishReplay } from '@kurasikapa/web-kit/bff/television'

const locale = z.enum(['en', 'fr'])
const presenterSchema = z.object({
  name: z.string().trim().min(2).max(120), slug: z.string().trim().min(2).max(120), locale,
  role: z.string().trim().min(2).max(160), biography: z.string().trim().min(20).max(2_000),
})
const programmeSchema = z.object({
  title: z.string().trim().min(2).max(160), slug: z.string().trim().min(2).max(160), locale,
  summary: z.string().trim().min(20).max(600), category: z.string().trim().min(2).max(80),
  presenterIds: z.array(z.string().min(1)).min(1).max(8),
})
const scheduleSchema = z.object({
  programmeId: z.string().min(1), locale, startsAt: z.coerce.date(), endsAt: z.coerce.date(),
  isLive: z.boolean(),
})
const replaySchema = z.object({
	slotId: z.string().min(1), replayAssetId: z.string().min(1), captionAssetId: z.string().min(1),
})

export async function createPresenterAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const parsed = presenterSchema.parse(input)
    const actor = await requireActor()
    return createAndPublishPresenter(actor, parsed, async () => {
      const draft = await container().createPresenter.execute({ actor, ...parsed, portraitAssetId: null })
      const published = await container().publishPresenter.execute({ actor, presenterId: draft.id })
      return { id: published.id }
    })
  })
}

export async function createProgrammeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const parsed = programmeSchema.parse(input)
    const actor = await requireActor()
    return createAndPublishProgramme(actor, parsed, async () => {
      const draft = await container().createProgramme.execute({
        actor, ...parsed, presenterIds: parsed.presenterIds.map(presenterId), artworkAssetId: null,
      })
      const published = await container().publishProgramme.execute({ actor, programmeId: draft.id })
      return { id: published.id }
    })
  })
}

export async function scheduleProgrammeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const parsed = scheduleSchema.parse(input)
    const actor = await requireActor()
    const payload = { ...parsed, startsAt: parsed.startsAt.toISOString(), endsAt: parsed.endsAt.toISOString() }
    return createSchedule(actor, payload, async () => {
      const slot = await container().scheduleProgramme.execute({
        actor, ...parsed, programmeId: programmeId(parsed.programmeId),
      })
      return { id: slot.id }
    })
  })
}

export async function publishReplayAction(input: unknown): Promise<ActionResult<{ id: string }>> {
	return attempt(async () => {
		const parsed = replaySchema.parse(input)
		const { slotId, ...assets } = parsed
		return publishReplay(await requireActor(), slotId, assets)
	})
}
