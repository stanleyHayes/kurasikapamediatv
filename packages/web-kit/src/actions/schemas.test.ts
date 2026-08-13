import { describe, expect, it } from 'vitest'
import {
  InvalidInput,
  createDraftSchema,
  draftBulletsSchema,
  draftPromptSchema,
  moderateCommentSchema,
  parseInput,
  postCommentSchema,
  rejectSchema,
  scheduleSchema,
  contactMessageSchema,
  subscribeNewsletterSchema,
  toneSchema,
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

describe('draftPromptSchema', () => {
  it('accepts a prompt and locale', () => {
    const parsed = parseInput(draftPromptSchema, {
      prompt: 'Ghana cedi rally after rate cut',
      locale: 'en',
    })

    expect(parsed.prompt).toBe('Ghana cedi rally after rate cut')
  })

  it('rejects an empty prompt — that is a blank cheque to the model', () => {
    expect(() => parseInput(draftPromptSchema, { prompt: '  ', locale: 'en' })).toThrow(
      InvalidInput,
    )
  })
})

describe('draftBulletsSchema', () => {
  it('accepts a non-empty bullet list', () => {
    const parsed = parseInput(draftBulletsSchema, {
      bullets: ['Rate cut', 'Cedi rally'],
      locale: 'fr',
    })

    expect(parsed.bullets).toEqual(['Rate cut', 'Cedi rally'])
  })

  it('rejects an empty list — nothing to expand', () => {
    expect(() => parseInput(draftBulletsSchema, { bullets: [], locale: 'en' })).toThrow(
      InvalidInput,
    )
  })

  it('rejects blank bullets', () => {
    expect(() =>
      parseInput(draftBulletsSchema, { bullets: ['Rate cut', '  '], locale: 'en' }),
    ).toThrow(InvalidInput)
  })
})

describe('toneSchema', () => {
  it('accepts a known tone on an article context', () => {
    const parsed = parseInput(toneSchema, {
      title: 'Budget',
      body: 'The minister…',
      locale: 'en',
      tone: 'urgent',
    })

    expect(parsed.tone).toBe('urgent')
  })

  it('rejects an invented tone — the port only knows five', () => {
    expect(() =>
      parseInput(toneSchema, {
        title: 'Budget',
        body: 'The minister…',
        locale: 'en',
        tone: 'sarcastic',
      }),
    ).toThrow(InvalidInput)
  })
})

describe('postCommentSchema', () => {
  it('accepts a remark', () => {
    expect(parseInput(postCommentSchema, { articleId: 'art_1', body: 'Noted.' }).body).toBe(
      'Noted.',
    )
  })

  it('rejects a blank body', () => {
    expect(() => parseInput(postCommentSchema, { articleId: 'art_1', body: '  ' })).toThrow(
      InvalidInput,
    )
  })
})

describe('moderateCommentSchema', () => {
  it('accepts a decision', () => {
    expect(
      parseInput(moderateCommentSchema, { commentId: 'cmt_1', decision: 'approve' }).decision,
    ).toBe('approve')
  })

  it('rejects an invented decision', () => {
    expect(() =>
      parseInput(moderateCommentSchema, { commentId: 'cmt_1', decision: 'ignore' }),
    ).toThrow(InvalidInput)
  })
})

describe('subscribeNewsletterSchema', () => {
  it('accepts a daily English signup', () => {
    expect(
      parseInput(subscribeNewsletterSchema, {
        email: 'editor@kurasikapa.tv',
        locales: ['en'],
        cadence: 'daily',
      }).cadence,
    ).toBe('daily')
  })

  it('rejects an empty locale list', () => {
    expect(() =>
      parseInput(subscribeNewsletterSchema, {
        email: 'editor@kurasikapa.tv',
        locales: [],
        cadence: 'daily',
      }),
    ).toThrow(InvalidInput)
  })
})

describe('contactMessageSchema', () => {
  it('accepts a complete note', () => {
    expect(
      parseInput(contactMessageSchema, {
        name: 'Ama Mensah',
        email: 'ama@example.com',
        message: 'Please correct the figure.',
      }).name,
    ).toBe('Ama Mensah')
  })

  it('rejects an empty message', () => {
    expect(() =>
      parseInput(contactMessageSchema, {
        name: 'Ama',
        email: 'ama@example.com',
        message: '',
      }),
    ).toThrow(InvalidInput)
  })
})
