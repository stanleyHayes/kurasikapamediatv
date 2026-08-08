import { describe, expect, it } from 'vitest'
import {
  InvalidInput,
  createDraftSchema,
  parseInput,
  rejectSchema,
  scheduleSchema,
  unpublishSchema,
} from './schemas'

const draft = {
  locale: 'en',
  title: 'Budget 2026 Explained',
  body: 'The finance minister…',
  categoryId: 'cat_business',
}

describe('createDraftSchema', () => {
  it('accepts a well-formed draft', () => {
    expect(parseInput(createDraftSchema, draft).title).toBe('Budget 2026 Explained')
  })

  it('trims the title, so a stray space does not become part of the slug', () => {
    expect(parseInput(createDraftSchema, { ...draft, title: '  Budget  ' }).title).toBe('Budget')
  })

  it('rejects a title that is only whitespace', () => {
    expect(() => parseInput(createDraftSchema, { ...draft, title: '   ' })).toThrow(InvalidInput)
  })

  it('rejects an absurd title, which is a paste accident or an attack', () => {
    expect(() => parseInput(createDraftSchema, { ...draft, title: 'x'.repeat(301) })).toThrow(
      InvalidInput,
    )
  })

  it('allows an empty body — a draft may start as a headline', () => {
    expect(() => parseInput(createDraftSchema, { ...draft, body: '' })).not.toThrow()
  })

  it('caps the tag list', () => {
    const tagIds = Array.from({ length: 21 }, (_, i) => `tag_${String(i)}`)
    expect(() => parseInput(createDraftSchema, { ...draft, tagIds })).toThrow(InvalidInput)
  })

  it('names the offending field', () => {
    try {
      parseInput(createDraftSchema, { ...draft, title: '' })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as InvalidInput).issues[0]).toContain('title')
    }
  })
})

describe('rejectSchema', () => {
  it('requires a note', () => {
    // An editor rejecting without saying why sends the author back to guess.
    expect(() => parseInput(rejectSchema, { articleId: 'art_1', note: '' })).toThrow(InvalidInput)
  })

  it('rejects a whitespace-only note', () => {
    expect(() => parseInput(rejectSchema, { articleId: 'art_1', note: '  ' })).toThrow(InvalidInput)
  })

  it('accepts a real note', () => {
    const parsed = parseInput(rejectSchema, { articleId: 'art_1', note: 'Needs a second source.' })
    expect(parsed.note).toBe('Needs a second source.')
  })
})

describe('unpublishSchema', () => {
  it('requires a reason for the audit log', () => {
    expect(() => parseInput(unpublishSchema, { articleId: 'art_1', reason: '' })).toThrow(
      InvalidInput,
    )
  })
})

describe('scheduleSchema', () => {
  it('coerces the wire format to a Date', () => {
    // The browser sends a string; the domain compares against an injected clock.
    const parsed = parseInput(scheduleSchema, {
      articleId: 'art_1',
      at: '2026-09-01T08:00:00.000Z',
    })

    expect(parsed.at).toBeInstanceOf(Date)
    expect(parsed.at.toISOString()).toBe('2026-09-01T08:00:00.000Z')
  })

  it('rejects a date that is not one', () => {
    expect(() => parseInput(scheduleSchema, { articleId: 'art_1', at: 'next tuesday' })).toThrow(
      InvalidInput,
    )
  })

  it('accepts a past date here — the domain owns that rule, not the parser', () => {
    // Duplicating ScheduleInPast in the schema would put one rule in two
    // places and let them drift.
    expect(() =>
      parseInput(scheduleSchema, { articleId: 'art_1', at: '2020-01-01T00:00:00.000Z' }),
    ).not.toThrow()
  })
})
