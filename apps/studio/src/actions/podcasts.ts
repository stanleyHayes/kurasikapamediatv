'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { createAndPublishEpisode, createAndPublishPodcast } from '@kurasikapa/web-kit/bff/podcasts'

const podcastSchema = z.object({ title: z.string().trim().min(3).max(160), slug: z.string().trim().min(3).max(180), locale: z.enum(['en', 'fr']), summary: z.string().trim().min(20).max(2_000), author: z.string().trim().min(2).max(160), artworkAssetID: z.string().optional() })
const chapterSchema = z.object({ title: z.string().trim().min(1).max(160), startsAtSec: z.number().nonnegative() })
const episodeSchema = z.object({ podcastID: z.string().min(1), title: z.string().trim().min(3).max(160), slug: z.string().trim().min(3).max(180), locale: z.enum(['en', 'fr']), summary: z.string().trim().min(20).max(2_000), audioAssetID: z.string().min(1), transcriptAssetID: z.string().min(1), durationSeconds: z.number().positive(), chapters: z.array(chapterSchema).max(40) })

export async function createPodcastAction(input: unknown): Promise<ActionResult<{ readonly id: string }>> {
  return attempt(async () => createAndPublishPodcast(await requireActor(), podcastSchema.parse(input)))
}
export async function createEpisodeAction(input: unknown): Promise<ActionResult<{ readonly id: string }>> {
  return attempt(async () => createAndPublishEpisode(await requireActor(), episodeSchema.parse(input)))
}
