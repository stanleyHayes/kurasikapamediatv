import { describe, expect, it } from 'vitest'
import { anApprovedArticle, anArticle, AUTHOR } from '../testing/builders'
import { commentId } from '../shared/ids'
import {
  AlreadyDecided,
  CannotCommentUnpublished,
  Comment,
  CommentTooLong,
  EmptyComment,
  MAX_COMMENT_BODY,
} from './comment'

const NOW = new Date('2026-08-11T10:00:00Z')
const ID = commentId('cmt_1')
const live = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })
const draft = (body: string): { id: typeof ID; readerId: typeof AUTHOR; body: string; now: Date } => ({
  id: ID,
  readerId: AUTHOR,
  body,
  now: NOW,
})

describe('Comment.post', () => {
  it('starts pending on a published article', () => {
    const comment = Comment.post(live(), draft('  Well said.  '))

    expect(comment.state).toBe('pending')
    expect(comment.body).toBe('Well said.')
    expect(comment.articleId).toBe(live().id)
    expect(comment.id).toBe(ID)
    expect(comment.readerId).toBe(AUTHOR)
    expect(Comment.reconstitute(comment.snapshot()).body).toBe('Well said.')
  })

  it('refuses an unpublished article', () => {
    expect(() => Comment.post(anArticle(), draft('Hi'))).toThrow(CannotCommentUnpublished)
  })

  it('refuses blank text', () => {
    expect(() => Comment.post(live(), draft('   '))).toThrow(EmptyComment)
  })

  it('refuses a body over the limit', () => {
    expect(() => Comment.post(live(), draft('x'.repeat(MAX_COMMENT_BODY + 1)))).toThrow(
      CommentTooLong,
    )
  })
})

describe('moderation', () => {
  it('makes a pending comment visible', () => {
    expect(Comment.post(live(), draft('Hi')).approve().state).toBe('visible')
  })

  it('rejects a pending comment', () => {
    expect(Comment.post(live(), draft('Hi')).reject().state).toBe('rejected')
  })

  it('refuses a second decision', () => {
    const visible = Comment.post(live(), draft('Hi')).approve()

    expect(() => visible.approve()).toThrow(AlreadyDecided)
    expect(() => visible.reject()).toThrow(AlreadyDecided)
  })
})
