import { describe, expect, it } from 'vitest'
import { articleId } from '../shared/ids'
import { PageView } from './page-view'

const base = {
  id: 'view-1', articleId: articleId('article-1'), locale: 'en',
  visitorHash: 'a'.repeat(64), channel: 'direct' as const,
  occurredAt: new Date('2026-08-31T12:00:00Z'),
}

describe('PageView', () => {
  it('records an immutable privacy-safe view', () => {
    const view = PageView.record(base)
    expect(view.snapshot()).toEqual(base)
  })

  it.each(['', 'short', 'z'.repeat(64)])('rejects an invalid visitor hash', (visitorHash) => {
    expect(() => PageView.record({ ...base, visitorHash })).toThrow('visitor hash')
  })

  it('rejects unsupported acquisition channels', () => {
    expect(() => PageView.record({ ...base, channel: 'unknown' as 'direct' })).toThrow('channel')
  })
})
