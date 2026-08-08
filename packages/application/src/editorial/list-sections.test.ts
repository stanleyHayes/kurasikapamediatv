import { Category, categoryId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { InMemoryCategoryRepository } from '../testing/in-memory-category-repository'
import { ListSections } from './list-sections'

const section = (id: string, slugs: Record<string, string>, order: number): Category =>
  Category.reconstitute({
    id: categoryId(id),
    parentId: null,
    slugs,
    names: { en: id },
    order,
  })

const repo = (): InMemoryCategoryRepository =>
  new InMemoryCategoryRepository([
    section('cat_culture', { en: 'culture' }, 3),
    section('cat_business', { en: 'business', fr: 'economie' }, 1),
    section('cat_politics', { fr: 'politique' }, 2),
  ])

describe('ListSections', () => {
  it('returns navigation in order', async () => {
    const sections = await new ListSections({ categories: repo() }).execute({ locale: 'en' })

    expect(sections.map((s) => s.id)).toEqual(['cat_business', 'cat_culture'])
  })

  it('omits sections not yet available in the locale', async () => {
    // A section rolls out to one language before another; the other simply
    // does not show it in navigation.
    const sections = await new ListSections({ categories: repo() }).execute({ locale: 'fr' })

    expect(sections.map((s) => s.id)).toEqual(['cat_business', 'cat_politics'])
  })

  it('returns nothing for an unknown locale rather than everything', async () => {
    const sections = await new ListSections({ categories: repo() }).execute({ locale: 'tw' })

    expect(sections).toEqual([])
  })
})
