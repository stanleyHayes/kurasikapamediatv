import { NotPermitted, Revision, articleId, revisionId } from '@kurasikapa/domain'
import { anApprovedArticle, anArticle, actorWith } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ArticleNotFound } from '../editorial/errors'
import { FakeAi } from '../testing/fake-ai'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryRevisionRepository } from '../testing/in-memory-revision-repository'
import { CaptionNeedsBody, ProposeSocialCaption } from './propose-social-caption'

const NOW = new Date('2026-08-12T10:00:00Z')
const MANAGER = actorWith(['social_media_manager'])
const READER = actorWith(['subscriber'])

const live = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

const wiring = (
  articles = [live()],
  body = 'Parliament passed the budget after midnight.',
): {
  readonly propose: ProposeSocialCaption
  readonly ai: FakeAi
} => {
  const ai = new FakeAi({
    socialCaption: { caption: 'Budget clears parliament.', hashtags: ['budget', 'ghana'] },
  })
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
    propose: new ProposeSocialCaption({
      articles: new InMemoryArticleRepository(articles),
      revisions,
      ai,
    }),
  }
}

describe('ProposeSocialCaption', () => {
  it('returns a caption proposal from the approved body', async () => {
    const { propose, ai } = wiring()

    const proposal = await propose.execute({
      actor: MANAGER,
      articleId: articleId('art_1'),
      platform: 'facebook',
    })

    expect(proposal.caption).toBe('Budget clears parliament.')
    expect(proposal.hashtags).toEqual(['budget', 'ghana'])
    expect(ai.methods()).toEqual(['socialCaption'])
  })

  it('refuses a reader', async () => {
    const { propose } = wiring()

    await expect(
      propose.execute({
        actor: READER,
        articleId: articleId('art_1'),
        platform: 'instagram',
      }),
    ).rejects.toThrow(NotPermitted)
  })

  it('hides unpublished articles the same way as a missing one', async () => {
    const { propose } = wiring([anArticle()])

    await expect(
      propose.execute({
        actor: MANAGER,
        articleId: articleId('art_1'),
        platform: 'facebook',
      }),
    ).rejects.toThrow(ArticleNotFound)
  })

  it('refuses when there is no approved body', async () => {
    const ai = new FakeAi()
    const propose = new ProposeSocialCaption({
      articles: new InMemoryArticleRepository([live()]),
      revisions: new InMemoryRevisionRepository(),
      ai,
    })

    await expect(
      propose.execute({
        actor: MANAGER,
        articleId: articleId('art_1'),
        platform: 'facebook',
      }),
    ).rejects.toThrow(CaptionNeedsBody)
    expect(ai.methods()).toEqual([])
  })
})
