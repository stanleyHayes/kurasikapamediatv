import { Slug, articleId, categoryId, familyId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ArticleNotFound } from '../editorial/errors'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { ListRelatedArticles } from './list-related-articles'

const NOW = new Date('2026-08-12T08:00:00Z')
const BUSINESS = categoryId('cat_business')
const POLITICS = categoryId('cat_politics')

const live = (
  id: string,
  options: { readonly categoryId?: typeof BUSINESS; readonly locale?: string } = {},
): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({
    id: articleId(id),
    familyId: familyId(`fam_${id}`),
    locale: options.locale ?? 'en',
    slug: Slug.of(id.replaceAll('_', '-')),
    title: id,
    categoryId: options.categoryId ?? BUSINESS,
    status: 'published',
    publishedAt: NOW,
  })

describe('ListRelatedArticles', () => {
  it('returns other published stories in the same section', async () => {
    const articles = new InMemoryArticleRepository([
      live('art_1'),
      live('art_2'),
      live('art_3', { categoryId: POLITICS }),
    ])

    const related = await new ListRelatedArticles(articles).execute({
      articleId: articleId('art_1'),
    })

    expect(related.map((row) => row.id)).toEqual(['art_2'])
  })

  it('excludes the current article and respects the limit', async () => {
    const articles = new InMemoryArticleRepository([
      live('art_1'),
      live('art_2'),
      live('art_3'),
      live('art_4'),
    ])

    const related = await new ListRelatedArticles(articles).execute({
      articleId: articleId('art_1'),
      limit: 2,
    })

    expect(related).toHaveLength(2)
    expect(related.map((row) => row.id)).not.toContain('art_1')
  })

  it('returns nothing for an unpublished article', async () => {
    const articles = new InMemoryArticleRepository([anArticle(), live('art_2')])

    await expect(
      new ListRelatedArticles(articles).execute({ articleId: articleId('art_1') }),
    ).resolves.toEqual([])
  })

  it('reports a missing article', async () => {
    await expect(
      new ListRelatedArticles(new InMemoryArticleRepository()).execute({
        articleId: articleId('art_missing'),
      }),
    ).rejects.toThrow(ArticleNotFound)
  })

  it('does not cross locales', async () => {
    const articles = new InMemoryArticleRepository([
      live('art_1'),
      live('art_2', { locale: 'fr' }),
    ])

    const related = await new ListRelatedArticles(articles).execute({
      articleId: articleId('art_1'),
    })

    expect(related).toEqual([])
  })
})
