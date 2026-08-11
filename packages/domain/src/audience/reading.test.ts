import { describe, expect, it } from 'vitest'
import { ARTICLE_STATUSES } from '../editorial/article-status'
import { userId } from '../shared/ids'
import { anApprovedArticle, anArticle } from '../testing/builders'
import { CannotRecordUnpublished, Reading } from './reading'

const READER = userId('usr_reader')
const NOW = new Date('2026-08-11T10:00:00Z')

const published = (): ReturnType<typeof anApprovedArticle> =>
  anApprovedArticle({ status: 'published', publishedAt: NOW })

describe('Reading.record', () => {
  it('records a visit to a published article', () => {
    const reading = Reading.record(READER, published(), NOW)

    expect(reading.readerId).toBe(READER)
    expect(reading.articleId).toBe(published().id)
    expect(reading.locale).toBe('en')
    expect(reading.readAt).toEqual(NOW)
    expect(Reading.reconstitute(reading.snapshot()).readAt).toEqual(NOW)
  })

  it.each(ARTICLE_STATUSES.filter((s) => s !== 'published'))(
    'refuses to record an article in state "%s"',
    (status) => {
      expect(() => Reading.record(READER, anArticle({ status }), NOW)).toThrow(
        CannotRecordUnpublished,
      )
    },
  )
})
