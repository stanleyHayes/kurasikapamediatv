import { Comment, articleId, commentId, userId } from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { toCommentView } from './comment-view'

describe('toCommentView', () => {
  it('serialises a comment for the RSC boundary', () => {
    const view = toCommentView(
      Comment.reconstitute({
        id: commentId('cmt_1'),
        articleId: articleId('art_1'),
        readerId: userId('usr_1'),
        body: 'Noted.',
        state: 'pending',
        createdAt: new Date('2026-08-11T10:00:00Z'),
      }),
    )

    expect(view).toEqual({
      id: 'cmt_1',
      articleId: 'art_1',
      readerId: 'usr_1',
      body: 'Noted.',
      state: 'pending',
      createdAt: '2026-08-11T10:00:00.000Z',
    })
  })
})
