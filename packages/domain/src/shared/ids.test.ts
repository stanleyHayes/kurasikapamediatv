import { describe, expect, it } from 'vitest'
import {
  EmptyIdentifier,
  articleId,
  assetId,
  broadcastId,
  categoryId,
  commentId,
  familyId,
  revisionId,
  tagId,
  userId,
} from './ids'

const CONSTRUCTORS = [
  ['articleId', articleId],
  ['familyId', familyId],
  ['revisionId', revisionId],
  ['categoryId', categoryId],
  ['tagId', tagId],
  ['userId', userId],
  ['assetId', assetId],
  ['commentId', commentId],
  ['broadcastId', broadcastId],
] as const

describe.each(CONSTRUCTORS)('%s', (_name, make) => {
  it('accepts a non-empty value', () => {
    expect(make('x_1')).toBe('x_1')
  })

  it('rejects an empty string', () => {
    expect(() => make('')).toThrow(EmptyIdentifier)
  })

  it('rejects whitespace only', () => {
    expect(() => make('   ')).toThrow(EmptyIdentifier)
  })
})

describe('EmptyIdentifier', () => {
  it('names the kind it rejected', () => {
    expect(() => articleId('')).toThrow('ArticleId cannot be empty')
  })
})
