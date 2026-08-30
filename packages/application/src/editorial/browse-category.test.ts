import {
  Category,
  Revision,
  articleId,
  categoryId,
  familyId,
  revisionId,
  userId,
} from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryCategoryRepository } from '../testing/in-memory-category-repository'
import { InMemoryRevisionRepository } from '../testing/in-memory-revision-repository'
import { BrowseCategory } from './browse-category'

const NOW = new Date('2026-08-08T10:00:00Z')
const BUSINESS = categoryId('cat_business')

const business = Category.reconstitute({
  id: BUSINESS,
  parentId: null,
  slugs: { en: 'business', fr: 'economie' },
  names: { en: 'Business', fr: 'Économie' },
  descriptions: {},
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
    revisions: new InMemoryRevisionRepository(),
  })

describe('BrowseCategory', () => {
  it('returns the section and its published articles', async () => {
    const result = await deps().execute({ slug: 'business', locale: 'en' })

    expect(result?.category.id).toBe(BUSINESS)
    expect(result?.articles.items.map((a) => a.article.id)).toEqual(['art_1'])
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

    expect(result?.articles.items.map((a) => a.article.id)).not.toContain('art_2')
  })

  it('excludes other sections', async () => {
    const result = await deps().execute({ slug: 'business', locale: 'en' })

    expect(result?.articles.items.map((a) => a.article.id)).not.toContain('art_3')
  })
})

describe('standfirsts', () => {
  it('takes the excerpt from the APPROVED revision, not the latest', async () => {
    // An editor may already be drafting a correction. The listing must show
    // what was approved, exactly as the article page does.
    const approved = Revision.reconstitute({
      id: revisionId('rev_approved'),
      articleId: articleId('art_1'),
      seq: 1,
      title: 'Approved',
      body: 'The approved standfirst that readers should see.',
      authorId: userId('usr_1'),
      createdAt: NOW,
    })
    const draftInProgress = Revision.reconstitute({
      id: revisionId('rev_draft'),
      articleId: articleId('art_1'),
      seq: 2,
      title: 'Draft',
      body: 'An unapproved correction nobody may read yet.',
      authorId: userId('usr_1'),
      createdAt: NOW,
    })

    const useCase = new BrowseCategory({
      categories: new InMemoryCategoryRepository([business]),
      articles: new InMemoryArticleRepository([
        anArticle({
          status: 'published',
          publishedAt: NOW,
          categoryId: BUSINESS,
          approvedRevisionId: revisionId('rev_approved'),
        }),
      ]),
      revisions: new InMemoryRevisionRepository([approved, draftInProgress]),
    })

    const result = await useCase.execute({ slug: 'business', locale: 'en' })

    expect(result?.articles.items[0]?.excerpt).toBe(
      'The approved standfirst that readers should see.',
    )
    expect(result?.articles.items[0]?.readingMinutes).toBe(1)
  })

  it('gives a null excerpt when the article has no approved revision stored', async () => {
    const result = await deps().execute({ slug: 'business', locale: 'en' })

    expect(result?.articles.items[0]?.excerpt).toBeNull()
  })
})
