'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { completeMediaUpload, createMediaUpload, type CreateMediaUploadResult, type MediaAssetView } from '@kurasikapa/web-kit/bff/media-library'

const createSchema = z.object({
  kind: z.enum(['image', 'video', 'audio', 'caption', 'transcript', 'document']),
  filename: z.string().trim().min(1).max(240), mimeType: z.string().trim().min(1).max(160),
  locale: z.enum(['en', 'fr']), altText: z.string().trim().max(500), caption: z.string().trim().max(1_000),
})
const completeSchema = z.object({
  assetId: z.string().min(1), publicID: z.string().min(1), secureURL: z.url(), signature: z.string().min(1),
  version: z.number().int().positive(), bytes: z.number().int().positive(), width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(), durationSeconds: z.number().nonnegative(),
})

export async function createMediaUploadAction(input: unknown): Promise<ActionResult<CreateMediaUploadResult>> {
  return attempt(async () => createMediaUpload(await requireActor(), createSchema.parse(input)))
}
export async function completeMediaUploadAction(input: unknown): Promise<ActionResult<MediaAssetView>> {
  return attempt(async () => {
    const parsed = completeSchema.parse(input)
    const { assetId, ...receipt } = parsed
    return completeMediaUpload(await requireActor(), assetId, receipt)
  })
}
