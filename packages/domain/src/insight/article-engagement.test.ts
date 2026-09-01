import { describe, expect, it } from 'vitest'
import { articleId } from '../shared/ids'
import { ArticleEngagement, type ArticleEngagementProps } from './article-engagement'

const base: ArticleEngagementProps = {
  id: 'engagement-1', articleId: articleId('article-1'), locale: 'en',
  visitorHash: 'a'.repeat(64), scrollDepth: 75, activeSeconds: 42,
  occurredAt: new Date('2026-09-01T12:00:00Z'),
}

describe('ArticleEngagement', () => {
  it('records privacy-safe reading depth without pointer coordinates', () => {
    expect(ArticleEngagement.record(base).snapshot()).toEqual(base)
  })

  it.each<[ArticleEngagementProps, string]>([
    [{ ...base, scrollDepth: 26 as 25 }, 'scroll depth'],
    [{ ...base, activeSeconds: -1 }, 'active seconds'],
    [{ ...base, activeSeconds: 3_601 }, 'active seconds'],
    [{ ...base, visitorHash: 'raw-reader-id' }, 'visitor hash'],
  ])('rejects invalid engagement input', (input, message) => {
    expect(() => ArticleEngagement.record(input)).toThrow(message)
  })
})
