import { describe, expect, it } from 'vitest'
import { calendarDataUrl, calendarStamp } from './schedule-calendar'

describe('schedule calendar reminder', () => {
  it('formats UTC timestamps for iCalendar', () => {
    expect(calendarStamp(new Date('2026-09-01T18:30:00Z'))).toBe('20260901T183000Z')
  })

  it('creates an encoded calendar event with a reminder', () => {
    const url = calendarDataUrl({
      id: 'slot_1', title: 'The Civic Desk', description: 'Watch live on Kurasikapa Media TV.',
      startsAt: new Date('2026-09-01T18:00:00Z'), endsAt: new Date('2026-09-01T19:00:00Z'),
      location: 'https://kurasikapa.tv/en/live',
    })

    expect(decodeURIComponent(url)).toContain('BEGIN:VALARM')
    expect(decodeURIComponent(url)).toContain('TRIGGER:-PT15M')
    expect(decodeURIComponent(url)).toContain('SUMMARY:The Civic Desk')
  })

  it('escapes punctuation that would break calendar fields', () => {
    const url = calendarDataUrl({
      id: 'slot,1', title: 'News, weather; analysis', description: 'Line one\nLine two',
      startsAt: new Date('2026-09-01T18:00:00Z'), endsAt: new Date('2026-09-01T19:00:00Z'),
      location: 'https://example.com/live',
    })
    const decoded = decodeURIComponent(url)

    expect(decoded).toContain('SUMMARY:News\\, weather\\; analysis')
    expect(decoded).toContain('DESCRIPTION:Line one\\nLine two')
  })
})
