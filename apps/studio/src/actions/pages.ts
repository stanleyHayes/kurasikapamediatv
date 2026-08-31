'use server'

import { SITE_PAGE_KEYS } from '@kurasikapa/domain'
import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { container } from '@kurasikapa/web-kit/composition/container'
import { encodeSitePageEntries } from '@kurasikapa/web-kit/read-model/site-page-entries'

const entry = z.object({ id: z.string().trim().max(80), title: z.string().trim().min(1).max(160), summary: z.string().trim().max(280), body: z.string().trim().min(1).max(8_000) })
const schema = z.object({ key: z.enum(SITE_PAGE_KEYS), locale: z.enum(['en', 'fr']), entries: z.array(entry).max(100) })
const TITLES = { careers: 'Careers', help: 'Help centre', faq: 'Frequently asked questions' } as const

export async function saveSitePageEntriesAction(input: unknown): Promise<ActionResult<{ updatedAt: string; entries: readonly z.infer<typeof entry>[] }>> {
  return attempt(async () => {
    const parsed = schema.parse(input)
    const actor = await requireActor()
    const entries = parsed.entries.map((item, index) => ({ ...item, id: item.id || entryId(item.title, index) }))
    const page = await container().manageSitePages.execute({ actor, key: parsed.key, locale: parsed.locale, title: TITLES[parsed.key], lead: '', body: encodeSitePageEntries(entries) })
    return { updatedAt: page.snapshot().updatedAt.toISOString(), entries }
  })
}

function entryId(title: string, index: number): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50)
  return `${slug || 'entry'}-${String(index + 1)}`
}
