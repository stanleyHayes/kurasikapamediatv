import {
  Actor,
  AlreadyDecided,
  CannotCommentUnpublished,
  Comment,
  EmptyComment,
  articleId,
  commentId,
  userId,
} from '@kurasikapa/domain'
import { anApprovedArticle, anArticle, actorWith } from '@kurasikapa/domain/testing'
import { describe, expect, it } from 'vitest'
import { ArticleNotFound } from '../editorial/errors'
import { FakeClock, SequentialIds } from '../testing/fakes'
import { InMemoryArticleRepository } from '../testing/in-memory-article-repository'
import { InMemoryCommentRepository } from '../testing/in-memory-comment-repository'
import { ListPendingComments, ListVisibleComments } from './list-comments'
import { CommentNotFound, ModerateComment } from './moderate-comment'
import { PostComment } from './post-comment'

const NOW = new Date('2026-08-11T10:00:00Z')
const READER = new Actor(userId('usr_reader'), ['subscriber'])
const EDITOR = actorWith(['editor'])
const target = articleId('art_1')

const published = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

const wiring = (
  articles = [published()],
): {
  readonly comments: InMemoryCommentRepository
  readonly post: PostComment
  readonly moderate: ModerateComment
} => {
  const comments = new InMemoryCommentRepository()
  const post = new PostComment({
    comments,
    articles: new InMemoryArticleRepository(articles),
    clock: new FakeClock(NOW),
    ids: new SequentialIds(),
  })
  return { comments, post, moderate: new ModerateComment({ comments }) }
}

describe('PostComment', () => {
  it('stores a pending comment on a published article', async () => {
    const { post, comments } = wiring()

    const result = await post.execute({ actor: READER, articleId: target, body: 'Noted.' })

    expect(result.state).toBe('pending')
    expect((await comments.findById(commentId(result.id)))?.body).toBe('Noted.')
  })

  it('refuses an unpublished article', async () => {
    const { post } = wiring([anArticle()])

    await expect(post.execute({ actor: READER, articleId: target, body: 'Hi' })).rejects.toThrow(
      CannotCommentUnpublished,
    )
  })

  it('reports a missing article', async () => {
    const { post } = wiring([])

    await expect(post.execute({ actor: READER, articleId: target, body: 'Hi' })).rejects.toThrow(
      ArticleNotFound,
    )
  })

  it('refuses blank text', async () => {
    const { post } = wiring()

    await expect(post.execute({ actor: READER, articleId: target, body: '  ' })).rejects.toThrow(
      EmptyComment,
    )
  })
})

describe('moderation and listing', () => {
  it('keeps pending remarks off the public list until approved', async () => {
    const { post, comments, moderate } = wiring()
    const posted = await post.execute({ actor: READER, articleId: target, body: 'Hi' })

    const hidden = await new ListVisibleComments(comments).execute({ articleId: target })
    expect(hidden.items).toHaveLength(0)

    await moderate.execute({ actor: EDITOR, commentId: commentId(posted.id), decision: 'approve' })

    const shown = await new ListVisibleComments(comments).execute({ articleId: target })
    expect(shown.items.map((c) => c.body)).toEqual(['Hi'])
  })

  it('refuses a journalist from moderating', async () => {
    const { post, moderate } = wiring()
    const posted = await post.execute({ actor: READER, articleId: target, body: 'Hi' })

    await expect(
      moderate.execute({
        actor: actorWith(['journalist']),
        commentId: commentId(posted.id),
        decision: 'approve',
      }),
    ).rejects.toThrow(/comment:moderate/u)
  })

  it('lists pending for an editor, oldest first', async () => {
    const { comments } = wiring()
    await comments.save(
      Comment.reconstitute({
        id: commentId('cmt_new'),
        articleId: target,
        readerId: READER.id,
        body: 'New',
        state: 'pending',
        createdAt: new Date('2026-08-11T12:00:00Z'),
      }),
    )
    await comments.save(
      Comment.reconstitute({
        id: commentId('cmt_old'),
        articleId: target,
        readerId: READER.id,
        body: 'Old',
        state: 'pending',
        createdAt: new Date('2026-08-11T09:00:00Z'),
      }),
    )

    const page = await new ListPendingComments(comments).execute({ actor: EDITOR })
    expect(page.items.map((c) => c.body)).toEqual(['Old', 'New'])
  })

  it('reports a missing comment', async () => {
    const { moderate } = wiring()

    await expect(
      moderate.execute({ actor: EDITOR, commentId: commentId('cmt_missing'), decision: 'reject' }),
    ).rejects.toThrow(CommentNotFound)
  })

  it('refuses a second decision', async () => {
    const { post, moderate } = wiring()
    const posted = await post.execute({ actor: READER, articleId: target, body: 'Hi' })
    await moderate.execute({ actor: EDITOR, commentId: commentId(posted.id), decision: 'reject' })

    await expect(
      moderate.execute({ actor: EDITOR, commentId: commentId(posted.id), decision: 'approve' }),
    ).rejects.toThrow(AlreadyDecided)
  })
})
