'use server'

import { z } from 'zod'
import { attempt, type ActionResult } from '@kurasikapa/web-kit/actions/result'
import { parseInput } from '@kurasikapa/web-kit/actions/schemas'
import { requireActor } from '@kurasikapa/web-kit/composition/actor'
import { createAndActivateAdCampaign, createAndActivateMembershipPlan, createAndActivateProduct, publishClassified } from '@kurasikapa/web-kit/bff/revenue'

const schema = z.object({ name: z.string().trim().min(2).max(80), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u), description: z.string().trim().min(20).max(500), interval: z.enum(['monthly', 'yearly']), currency: z.enum(['GHS', 'EUR']), amountMinor: z.number().int().min(500).max(10_000_000), benefits: z.array(z.string().trim().min(2).max(120)).min(1).max(8) })
const adSchema = z.object({ name: z.string().trim().min(2).max(100), advertiser: z.string().trim().min(2).max(100), locale: z.enum(['en', 'fr', '*']), slot: z.enum(['home_leaderboard', 'article_inline', 'live_companion']), creativeURL: z.url().startsWith('https://'), altText: z.string().trim().min(5).max(180), landingURL: z.url().startsWith('https://'), currency: z.enum(['GHS', 'EUR']), budgetMinor: z.number().int().min(100), cpmMinor: z.number().int().min(1), priority: z.number().int().min(1).max(100), startsAt: z.iso.datetime(), endsAt: z.iso.datetime() }).refine((value) => value.endsAt > value.startsAt, { message: 'The campaign end must follow its start.', path: ['endsAt'] }).refine((value) => value.cpmMinor <= value.budgetMinor, { message: 'CPM cannot exceed the campaign budget.', path: ['cpmMinor'] })

export async function createMembershipPlanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const parsed = parseInput(schema, input)
    return createAndActivateMembershipPlan(await requireActor(), {
      name: parsed.name, slug: parsed.slug, description: parsed.description,
      interval: parsed.interval, price: { minor: parsed.amountMinor, currency: parsed.currency },
      benefits: parsed.benefits,
    })
  })
}

export async function createAdCampaignAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return attempt(async () => {
    const parsed = parseInput(adSchema, input)
    return createAndActivateAdCampaign(await requireActor(), {
      name: parsed.name, advertiser: parsed.advertiser, locale: parsed.locale, slot: parsed.slot,
      creativeURL: parsed.creativeURL, altText: parsed.altText, landingURL: parsed.landingURL,
      budget: { minor: parsed.budgetMinor, currency: parsed.currency }, cpmMinor: parsed.cpmMinor,
      priority: parsed.priority, startsAt: parsed.startsAt, endsAt: parsed.endsAt,
    })
  })
}

const productSchema = z.object({ name: z.string().trim().min(2).max(120), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u), sku: z.string().trim().min(2).max(40), description: z.string().trim().min(20).max(1000), imageURL: z.url().startsWith('https://'), imageAlt: z.string().trim().min(5).max(180), currency: z.enum(['GHS', 'EUR']), amountMinor: z.number().int().positive(), stock: z.number().int().min(1).max(1_000_000) })
export async function createProductAction(input: unknown): Promise<ActionResult<{ id: string }>> { return attempt(async () => { const parsed = parseInput(productSchema, input); return createAndActivateProduct(await requireActor(), { name: parsed.name, slug: parsed.slug, sku: parsed.sku, description: parsed.description, imageURL: parsed.imageURL, imageAlt: parsed.imageAlt, price: { minor: parsed.amountMinor, currency: parsed.currency }, stock: parsed.stock }) }) }
export async function publishClassifiedAction(input: unknown): Promise<ActionResult<Record<string, never>>> { return attempt(async () => { const parsed = parseInput(z.object({ id: z.string().min(1).max(100) }), input); await publishClassified(await requireActor(), parsed.id); return {} }) }
