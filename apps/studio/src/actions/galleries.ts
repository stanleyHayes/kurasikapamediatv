'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { createAndPublishGallery } from '@kurasikapa/web-kit/bff/galleries'

const itemSchema = z.object({ assetID: z.string().min(1), captionAssetID: z.string().min(1).optional(), caption: z.string().trim().min(3).max(500), credit: z.string().trim().max(160) })
const gallerySchema = z.object({ kind: z.enum(['photo', 'video']), title: z.string().trim().min(3).max(160), slug: z.string().trim().min(3).max(180), locale: z.enum(['en', 'fr']), summary: z.string().trim().min(20).max(2_000), items: z.array(itemSchema).min(1).max(24) })

export async function createGalleryAction(input: unknown): Promise<ActionResult<{ readonly id: string }>> {
  return attempt(async () => createAndPublishGallery(await requireActor(), gallerySchema.parse(input)))
}
