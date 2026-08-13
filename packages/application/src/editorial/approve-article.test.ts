import { NotPermitted, Revision, articleId, revisionId, userId } from '@kurasikapa/domain'
import { anArticle } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { NOW, aJournalist, anEditor, harness } from '../testing/harness'
import { ApproveArticle } from './approve-article'
import { ArticleNotFound, RevisionNotFound, RevisionNotOfArticle } from './errors'

const target = articleId('art_1')
const approved = revisionId('rev_1')

const revisionFor = (article = target, id = approved): Revision =>
  Revision.append(
    {
      id,
      articleId: article,
      title: 'Budget 2026',
      body: 'body',
      authorId: userId('usr_author'),
      createdAt: NOW,
      trigger: 'edit',
    },
    null,
  )

const inReview = (): ReturnType<typeof anArticle> => anArticle({ status: 'in_review' })

describe('ApproveArticle', () => {
  it('approves and records which revision was approved', async () => {
    const h = harness({ articles: [inReview()], revisions: [revisionFor()] })
    const result = await new ApproveArticle(h).execute({
      actor: anEditor,
      articleId: target,
      revisionId: approved,
    })

    expect(result.status).toBe('approved')
    expect((await h.articles.findById(target))?.snapshot().approvedRevisionId).toBe(approved)
  })

  it('carries the revision id on the event', async () => {
    const h = harness({ articles: [inReview()], revisions: [revisionFor()] })
    await new ApproveArticle(h).execute({ actor: anEditor, articleId: target, revisionId: approved })

    expect(h.events.last()).toMatchObject({ name: 'article.approved', revisionId: approved })
  })

  it('appends a history entry for the approval without moving the pinned revision', async () => {
    // The approve revision is a record that the transition happened — the
    // approved text is still the revision the editor pointed at.
    const h = harness({ articles: [inReview()], revisions: [revisionFor()] })
    await new ApproveArticle(h).execute({ actor: anEditor, articleId: target, revisionId: approved })

    const history = await h.revisions.listFor(target)
    expect(history).toHaveLength(2)

    const entry = history.at(-1)!
    expect(entry.seq).toBe(2)
    expect(entry.trigger).toBe('approve')
    expect((await h.articles.findById(target))?.snapshot().approvedRevisionId).toBe(approved)
  })

  it('reports an unknown article', async () => {
    const h = harness({ revisions: [revisionFor()] })
    await expect(
      new ApproveArticle(h).execute({
        actor: anEditor,
        articleId: articleId('art_missing'),
        revisionId: approved,
      }),
    ).rejects.toThrow(ArticleNotFound)
  })

  it('reports an unknown revision', async () => {
    const h = harness({ articles: [inReview()] })
    await expect(
      new ApproveArticle(h).execute({
        actor: anEditor,
        articleId: target,
        revisionId: revisionId('rev_missing'),
      }),
    ).rejects.toThrow(RevisionNotFound)
  })

  it("refuses a revision belonging to a different article", async () => {
    // Without this guard an editor could approve article A while pointing at
    // a revision of article B, and the wrong text would publish.
    const foreign = revisionFor(articleId('art_other'), revisionId('rev_other'))
    const h = harness({ articles: [inReview()], revisions: [foreign] })

    await expect(
      new ApproveArticle(h).execute({
        actor: anEditor,
        articleId: target,
        revisionId: revisionId('rev_other'),
      }),
    ).rejects.toThrow(RevisionNotOfArticle)

    expect((await h.articles.findById(target))?.status).toBe('in_review')
  })

  it('refuses a journalist approving their own work', async () => {
    const h = harness({ articles: [inReview()], revisions: [revisionFor()] })

    await expect(
      new ApproveArticle(h).execute({
        actor: aJournalist,
        articleId: target,
        revisionId: approved,
      }),
    ).rejects.toThrow(NotPermitted)

    expect(h.events.published).toHaveLength(0)
  })
})
