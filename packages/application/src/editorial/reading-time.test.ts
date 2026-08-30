import { describe, expect, it } from 'vitest'
import { readingTimeMinutes } from './reading-time'

describe('readingTimeMinutes', () => {
  it('uses a one-minute minimum', () => {
    expect(readingTimeMinutes('A short update.')).toBe(1)
  })

  it('rounds up partial minutes at 200 words per minute', () => {
    expect(readingTimeMinutes(Array.from({ length: 201 }, () => 'word').join(' '))).toBe(2)
  })
})
