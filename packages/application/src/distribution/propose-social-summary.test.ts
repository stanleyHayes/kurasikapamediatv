import { NotPermitted, Revision, articleId, revisionId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle, actorWith } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ArticleNotFound } from '../editorial/errors'
import { GetPublishedArticle } from '../editorial/get-published-article'
import { FakeAi } from '../testing/fake-ai'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryRevisionRepository } from '../testing/in-memory-revision-repository'
import { CaptionNeedsBody } from './propose-social-caption'
import { ProposeSocialSummary } from './propose-social-summary'

const NOW = new Date('2026-08-12T10:00:00Z')
const MANAGER = actorWith(['social_media_manager'])
const READER = actorWith(['subscriber'])

const live = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

const request = {
  actor: MANAGER,
  articleId: articleId('art_1'),
  slug: 'budget-2026',
  locale: 'en',
} as const

const wiring = (
  articles = [live()],
  body = 'Parliament passed the budget after midnight.',
): {
  readonly propose: ProposeSocialSummary
  readonly ai: FakeAi
} => {
  const ai = new FakeAi({
    summary: { short: 'Budget clears parliament.', bullets: ['Passed after midnight'] },
  })
  const articlesRepo = new InMemoryArticleRepository(articles)
  const revisions = new InMemoryRevisionRepository([
    Revision.reconstitute({
      id: revisionId('rev_1'),
      articleId: articleId('art_1'),
      seq: 1,
      title: 'Budget 2026',
      body,
      authorId: articles[0]!.authorId,
      createdAt: NOW,
    }),
  ])

  return {
    ai,
    propose: new ProposeSocialSummary({
      published: new GetPublishedArticle({ articles: articlesRepo, revisions }),
      ai,
    }),
  }
}

describe('ProposeSocialSummary', () => {
  it('returns a summary of the approved body', async () => {
    const { propose, ai } = wiring()

    const summary = await propose.execute(request)

    expect(summary.short).toBe('Budget clears parliament.')
    expect(ai.methods()).toEqual(['summarise'])
  })

  it('refuses a reader', async () => {
    const { propose } = wiring()

    await expect(propose.execute({ ...request, actor: READER })).rejects.toThrow(NotPermitted)
  })

  it('hides unpublished articles the same way as a missing one', async () => {
    const { propose } = wiring([anArticle()])

    await expect(propose.execute(request)).rejects.toThrow(ArticleNotFound)
  })

  it('refuses when there is no approved body, without spending tokens', async () => {
    const ai = new FakeAi()
    const articles = new InMemoryArticleRepository([live()])
    const revisions = new InMemoryRevisionRepository()
    const propose = new ProposeSocialSummary({
      published: new GetPublishedArticle({ articles, revisions }),
      ai,
    })

    await expect(propose.execute(request)).rejects.toThrow(CaptionNeedsBody)
    expect(ai.methods()).toEqual([])
  })
})
