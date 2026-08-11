import { ArticleNotFound, CommentNotFound, EmailDeliveryFailed, SlugTaken } from '@kurasikapa/application'
import {
  CannotLikeUnpublished,
  EmptyComment,
  InvalidEmail,
  IllegalTransition,
  NotPermitted,
  articleId,
  commentId,
  userId,
} from '@kurasikapa/domain'
import { describe, expect, it } from 'vitest'
import { ApiProblem } from '../bff/problem'
import { NotSignedIn } from '../composition/actor'
import { attempt, toActionError } from './result'
import { InvalidInput } from './schemas'

describe('toActionError', () => {
  it.each([
    [new NotSignedIn(), 'not_signed_in'],
    [new NotPermitted(userId('usr_1'), 'article:publish'), 'not_permitted'],
    [new IllegalTransition(articleId('art_1'), 'publish', 'draft'), 'illegal_transition'],
    [new ArticleNotFound(articleId('art_1')), 'article_not_found'],
    [new SlugTaken('budget-2026', 'en'), 'slug_taken'],
    [new InvalidInput(['title: required']), 'invalid_input'],
    [new EmptyComment(), 'empty_comment'],
    [new CannotLikeUnpublished(articleId('art_1')), 'cannot_like_unpublished'],
    [new CommentNotFound(commentId('cmt_1')), 'comment_not_found'],
    [new InvalidEmail('nope'), 'invalid_email'],
    [new EmailDeliveryFailed(), 'email_delivery_failed'],
    [new ApiProblem('slug_taken', 'Slug is already in use'), 'slug_taken'],
    [new ApiProblem('not_permitted', 'Not permitted'), 'not_permitted'],
  ])('maps %s to a stable code', (error, code) => {
    // Codes are stable across locales so the UI can translate them; messages
    // are for logs and developers.
    expect(toActionError(error).code).toBe(code)
  })

  it('keeps the underlying message for the log', () => {
    expect(toActionError(new SlugTaken('budget-2026', 'en')).message).toContain('budget-2026')
  })

  it('rethrows anything unrecognised', () => {
    // An unexpected error is a bug. Flattening it into a shrug for the user
    // would hide it from the error boundary and the logs both.
    expect(() => toActionError(new TypeError('cannot read property of undefined'))).toThrow(
      TypeError,
    )
  })

  it('rethrows a non-Error value rather than inventing a code', () => {
    expect(() => toActionError('something odd')).toThrow()
  })
})

describe('attempt', () => {
  it('wraps a success', async () => {
    expect(await attempt(() => Promise.resolve(42))).toEqual({ ok: true, data: 42 })
  })

  it('wraps an expected failure as a result the form can render', async () => {
    // An editor really will try to publish something that lost its approval.
    // That is an outcome, not an exception.
    const result = await attempt(() => Promise.reject(new ArticleNotFound(articleId('art_x'))))

    expect(result).toEqual({
      ok: false,
      error: { code: 'article_not_found', message: 'Article art_x not found' },
    })
  })

  it('lets an unexpected failure escape to the error boundary', async () => {
    await expect(attempt(() => Promise.reject(new RangeError('bug')))).rejects.toThrow(RangeError)
  })
})
