import { describe, expect, it } from 'vitest'
import {
  dailyPeriodKey,
  digestPeriodKey,
  digestWindowStart,
  weeklyPeriodKey,
} from './digest-period'

const NOW = new Date('2026-08-11T19:00:00Z')

describe('digestPeriodKey', () => {
  it('names the UTC day and ISO week', () => {
    expect(dailyPeriodKey(NOW)).toBe('2026-08-11')
    expect(weeklyPeriodKey(NOW)).toBe('2026-W33')
    expect(digestPeriodKey('daily', NOW)).toBe('2026-08-11')
    expect(digestWindowStart('daily', NOW).toISOString()).toBe('2026-08-10T19:00:00.000Z')
  })
})
