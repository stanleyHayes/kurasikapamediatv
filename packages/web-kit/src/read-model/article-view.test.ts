import { Slug, articleId, assetId, categoryId, familyId, revisionId, userId } from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { toArticleView } from './article-view'

const PUBLISHED_AT = new Date('2026-08-08T10:00:00Z')

describe('toArticleView', () => {
  it('flattens value objects into strings a Server Component can serialise', () => {
    const view = toArticleView(anArticle({ status: 'published', publishedAt: PUBLISHED_AT }))

    expect(view).toEqual({
      id: 'art_1',
      slug: 'budget-2026',
      locale: 'en',
      title: 'Budget 2026',
      categoryId: 'cat_business',
      publishedAt: '2026-08-08T10:00:00.000Z',
      hero: null,
    })
  })

  it('carries no Date, no Slug and no behaviour across the RSC boundary', () => {
    // Domain entities carry methods and value objects; neither survives
    // serialisation. Converting once here keeps Article free of pressure to be
    // serialisable, which it should never feel.
    const view = toArticleView(anArticle({ publishedAt: PUBLISHED_AT }))

    expect(Object.values(view).every((v) => v === null || typeof v === 'string')).toBe(true)
  })

  it('represents an unpublished article with a null date, not an invalid one', () => {
    expect(toArticleView(anArticle()).publishedAt).toBeNull()
  })

  it('serialises the credited lead image snapshot', () => {
    const hero = { assetId: assetId('asset_1'), secureUrl: 'https://cdn.test/report.jpg', altText: 'A market reporter', caption: 'Reporting at Makola.', credit: 'Kurasikapa / Ama', width: 1600, height: 900 }
    expect(toArticleView(anArticle({ hero })).hero).toEqual(hero)
  })

  it('keeps a non-ASCII slug intact', () => {
    // Twi and French slugs must survive to the URL unchanged.
    const article = anArticle({
      id: articleId('art_tw'),
      familyId: familyId('fam_tw'),
      slug: Slug.of('sikasɛm-2026'),
      locale: 'tw',
      authorId: userId('usr_author'),
      categoryId: categoryId('cat_business'),
      approvedRevisionId: revisionId('rev_1'),
    })

    expect(toArticleView(article).slug).toBe('sikasɛm-2026')
  })
})
