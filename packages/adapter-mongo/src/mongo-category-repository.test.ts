import { Category, categoryId } from '@kurasikapa/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { MongoCategoryRepository } from './mongo-category-repository'
import { type MongoHarness, startMongo } from './testing/mongo-harness'

let mongo: MongoHarness
let repo: MongoCategoryRepository

beforeAll(async () => {
  mongo = await startMongo()
  repo = new MongoCategoryRepository(mongo.db)
})

afterEach(async () => {
  await mongo.reset()
})

afterAll(async () => {
  await mongo.stop()
})

const category = (id: string, slugs: Record<string, string>, order = 1): Category =>
  Category.reconstitute({
    id: categoryId(id),
    parentId: null,
    slugs,
    names: { en: id, fr: id },
    order,
  })

describe('round trip', () => {
  it('preserves every field', async () => {
    const original = category('cat_business', { en: 'business', fr: 'economie' }, 3)
    await repo.save(original)

    const loaded = await repo.findById(categoryId('cat_business'))

    expect(loaded?.snapshot()).toEqual(original.snapshot())
  })

  it('returns null for an unknown id', async () => {
    expect(await repo.findById(categoryId('cat_missing'))).toBeNull()
  })
})

describe('findBySlug', () => {
  it('resolves a localised slug to the same category', async () => {
    await repo.save(category('cat_business', { en: 'business', fr: 'economie' }))

    expect((await repo.findBySlug('business', 'en'))?.id).toBe('cat_business')
    expect((await repo.findBySlug('economie', 'fr'))?.id).toBe('cat_business')
  })

  it('does not resolve an English slug under a French locale', async () => {
    await repo.save(category('cat_business', { en: 'business', fr: 'economie' }))

    expect(await repo.findBySlug('business', 'fr')).toBeNull()
  })
})

describe('uniqueness', () => {
  it('refuses two categories sharing a slug in one locale', async () => {
    await repo.save(category('cat_a', { en: 'business' }))

    await expect(repo.save(category('cat_b', { en: 'business' }))).rejects.toThrow(/duplicate key/iu)
  })

  it('allows the same word as a slug in different locales', async () => {
    await repo.save(category('cat_a', { en: 'sport' }))

    await expect(repo.save(category('cat_b', { fr: 'sport' }))).resolves.toBeUndefined()
  })
})

describe('listForLocale', () => {
  it('returns only categories reachable in that locale, in navigation order', async () => {
    // A section rolls out to one language before another; the other language
    // simply does not show it.
    await repo.save(category('cat_c', { en: 'culture' }, 3))
    await repo.save(category('cat_a', { en: 'business', fr: 'economie' }, 1))
    await repo.save(category('cat_b', { fr: 'politique' }, 2))

    const en = await repo.listForLocale('en')
    const fr = await repo.listForLocale('fr')

    expect(en.map((c) => c.id)).toEqual(['cat_a', 'cat_c'])
    expect(fr.map((c) => c.id)).toEqual(['cat_a', 'cat_b'])
  })
})
