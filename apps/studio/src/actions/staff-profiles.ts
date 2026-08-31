'use server'

import { requirePermission } from '@kurasikapa/domain'
import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { saveAndPublishStaffProfile } from '@kurasikapa/web-kit/bff/staff-profiles'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'

const schema = z.object({
  userId: z.string().trim().min(1), locale: z.enum(['en', 'fr']),
  displayName: z.string().trim().min(2).max(120), jobTitle: z.string().trim().min(2).max(160),
  biography: z.string().trim().min(40).max(2_000), portraitAssetId: z.string().trim().min(1),
  socialLabel: z.string().trim().max(50).optional(), socialUrl: z.union([z.literal(''), z.url({ protocol: /^https$/u })]).optional(),
})

export async function publishStaffProfileAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const parsed = schema.parse(input)
    const actor = await requireActor()
    requirePermission(actor, 'profile:manage')
    const socialLinks = parsed.socialUrl === undefined || parsed.socialUrl === '' ? [] : [{ label: parsed.socialLabel ?? 'Profile', url: parsed.socialUrl }]
    return saveAndPublishStaffProfile(actor, parsed.userId, {
      locale: parsed.locale, displayName: parsed.displayName, jobTitle: parsed.jobTitle,
      biography: parsed.biography, portraitAssetId: parsed.portraitAssetId, socialLinks,
    })
  })
}
