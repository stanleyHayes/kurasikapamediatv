import { Category, articleId, categoryId, familyId } from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryCategoryRepository } from '../testing/in-memory-category-repository'
import { BrowseCategory } from './browse-category'

const NOW = new Date('2026-08-08T10:00:00Z')
const BUSINESS = categoryId('cat_business')

const business = Category.reconstitute({
  id: BUSINESS,
  parentId: null,
  slugs: { en: 'business', fr: 'economie' },
  names: { en: 'Business', fr: 'Économie' },
  order: 1,
})

const deps = (): BrowseCategory =>
  new BrowseCategory({
    categories: new InMemoryCategoryRepository([business]),
    articles: new InMemoryArticleRepository([
      anArticle({ status: 'published', publishedAt: NOW, categoryId: BUSINESS }),
      anArticle({
        id: articleId('art_2'),
        familyId: familyId('fam_2'),
        status: 'draft',
        categoryId: BUSINESS,
      }),
      anArticle({
        id: articleId('art_3'),
        familyId: familyId('fam_3'),
        status: 'published',
        publishedAt: NOW,
        categoryId: categoryId('cat_sports'),
      }),
    ]),
  })

describe('BrowseCategory', () => {
  it('returns the section and its published articles', async () => {
    const result = await deps().execute({ slug: 'business', locale: 'en' })

    expect(result?.category.id).toBe(BUSINESS)
    expect(result?.articles.items.map((a) => a.id)).toEqual(['art_1'])
  })

  it('resolves the localised slug', async () => {
    // /fr/economie must reach the same section as /en/business.
    const result = await deps().execute({ slug: 'economie', locale: 'fr' })

    expect(result?.category.id).toBe(BUSINESS)
  })

  it('does not resolve an English slug under a French URL', async () => {
    expect(await deps().execute({ slug: 'business', locale: 'fr' })).toBeNull()
  })

  it('returns null for an unknown section, which the page turns into a 404', async () => {
    expect(await deps().execute({ slug: 'astrology', locale: 'en' })).toBeNull()
  })

  it('excludes drafts', async () => {
    const result = await deps().execute({ slug: 'business', locale: 'en' })

    expect(result?.articles.items.map((a) => a.id)).not.toContain('art_2')
  })

  it('excludes other sections', async () => {
    const result = await deps().execute({ slug: 'business', locale: 'en' })

    expect(result?.articles.items.map((a) => a.id)).not.toContain('art_3')
  })
})
